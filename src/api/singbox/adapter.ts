// 把 sing-box native gRPC(daemon.StartedService)的订阅流/一元调用,适配成与
// Clash WS API 相同的数据形状,供 src/api/index.ts 在 sing-box 后端下分支调用,
// 让 connections / logs / overview 等页面无需改动即可工作。
// 注:proxies 的组装逻辑已独立到 store/proxiesSingbox.ts(流驱动),不在此处。

import {
  ConnectionEventType,
  LogLevel,
  type Connection as PbConnection,
} from '@/gen/daemon/started_service_pb'
import type { Config, ConnectionRawMessage, Log } from '@/types'
import { ref, type Ref } from 'vue'
import { getSingboxClient } from './client'
import { runStream, type StreamHandle } from './streams'

const SUBSCRIPTION_INTERVAL = 1_000_000_000n // 1s(ns)

// ---------- 通用映射工具 ----------

// 拆分 "ip:port" / "[ipv6]:port"
const splitHostPort = (s: string): [string, string] => {
  if (!s) return ['', '']
  const idx = s.lastIndexOf(':')
  if (idx === -1) return [s, '']
  let host = s.slice(0, idx)
  const port = s.slice(idx + 1)
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)
  return [host, port]
}

// sing-box 的日志消息携带 ANSI 颜色转义码(如 \x1b[36m ... \x1b[0m),需剥离。
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string) => s.replace(ANSI_PATTERN, '')

const logLevelToType = (level: LogLevel): Log['type'] => {
  switch (level) {
    case LogLevel.PANIC:
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      return 'error'
    case LogLevel.WARN:
      return 'warning'
    case LogLevel.DEBUG:
    case LogLevel.TRACE:
      return 'debug'
    default:
      return 'info'
  }
}

const logLevelFilterFromParam = (level?: string): LogLevel | null | undefined => {
  switch (level?.toLowerCase()) {
    case 'panic':
      return LogLevel.PANIC
    case 'fatal':
      return LogLevel.FATAL
    case 'error':
      return LogLevel.ERROR
    case 'warning':
    case 'warn':
      return LogLevel.WARN
    case 'info':
      return LogLevel.INFO
    case 'debug':
      return LogLevel.DEBUG
    case 'trace':
      return LogLevel.TRACE
    case 'silent':
      return null
    default:
      return undefined
  }
}

// ---------- connections ----------

const mapConnection = (c: PbConnection): ConnectionRawMessage => {
  const [sourceIP, sourcePort] = splitHostPort(c.source)
  const [destinationIP, destinationPort] = splitHostPort(c.destination)
  const processPath = c.processInfo?.processPath ?? ''
  const process = processPath.split(/[\\/]/).pop() ?? ''

  return {
    id: c.id,
    download: Number(c.downlinkTotal),
    upload: Number(c.uplinkTotal),
    chains: c.chainList.length ? [...c.chainList] : [c.outbound].filter(Boolean),
    rule: c.rule,
    start: Number(c.createdAt),
    metadata: {
      destinationIP,
      destinationPort,
      host: c.domain,
      inboundName: c.inbound,
      inboundUser: c.user,
      network: c.network,
      process,
      processPath,
      remoteDestination: destinationIP,
      sniffHost: c.domain,
      sourceIP,
      sourcePort,
      type: c.inboundType,
      uid: c.processInfo?.userId ?? 0,
    },
  } as ConnectionRawMessage
}

export interface SingboxStream<T> {
  data: Ref<T | undefined>
  close: () => void
}

export const fetchSingboxConnections = <T>(): SingboxStream<T> => {
  const data = ref<T>()
  const client = getSingboxClient()?.client
  if (!client) return { data, close: () => {} }

  const conns = new Map<string, ConnectionRawMessage>()
  let downloadTotal = 0
  let uploadTotal = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const emit = () => {
    timer = null
    data.value = {
      connections: Array.from(conns.values()),
      downloadTotal,
      uploadTotal,
      memory: 0,
    } as T
  }
  const scheduleEmit = () => {
    if (timer) return
    timer = setTimeout(emit, 100)
  }

  const handle: StreamHandle = runStream(
    (signal) => client.subscribeConnections({ interval: SUBSCRIPTION_INTERVAL }, { signal }),
    (msg) => {
      if (msg.reset) {
        conns.clear()
      }
      for (const event of msg.events) {
        uploadTotal += Number(event.uplinkDelta)
        downloadTotal += Number(event.downlinkDelta)

        switch (event.type) {
          case ConnectionEventType.CONNECTION_EVENT_NEW:
            if (event.connection) conns.set(event.id, mapConnection(event.connection))
            break
          case ConnectionEventType.CONNECTION_EVENT_UPDATE: {
            if (event.connection) {
              conns.set(event.id, mapConnection(event.connection))
            } else {
              const existing = conns.get(event.id)
              if (existing) {
                existing.upload += Number(event.uplinkDelta)
                existing.download += Number(event.downlinkDelta)
              }
            }
            break
          }
          case ConnectionEventType.CONNECTION_EVENT_CLOSED:
            conns.delete(event.id)
            break
        }
      }
      scheduleEmit()
    },
  )

  return {
    data,
    close: () => {
      if (timer) clearTimeout(timer)
      handle.close()
    },
  }
}

export const closeSingboxConnection = async (id: string) => {
  const client = getSingboxClient()?.client
  if (!client) return
  await client.closeConnection({ id })
}

export const closeAllSingboxConnections = async () => {
  const client = getSingboxClient()?.client
  if (!client) return
  await client.closeAllConnections({})
}

// ---------- logs ----------

export const fetchSingboxLogs = <T>(params: Record<string, string> = {}): SingboxStream<T> => {
  const data = ref<T>()
  const client = getSingboxClient()?.client
  if (!client) return { data, close: () => {} }
  const levelFilter = logLevelFilterFromParam(params.level)

  // 日志按批到达,但消费方(logs store)逐条 watch ws.data,需要逐条投递。
  const queue: Log[] = []
  let draining = false
  const drain = () => {
    if (draining) return
    draining = true
    const step = () => {
      const next = queue.shift()
      if (!next) {
        draining = false
        return
      }
      data.value = next as T
      setTimeout(step, 0)
    }
    step()
  }

  const handle = runStream(
    (signal) => client.subscribeLog({}, { signal }),
    (msg) => {
      if (msg.reset) queue.length = 0
      for (const m of msg.messages) {
        if (levelFilter === null || (levelFilter !== undefined && m.level > levelFilter)) continue
        queue.push({ type: logLevelToType(m.level), payload: stripAnsi(m.message) })
      }
      drain()
    },
  )

  return {
    data,
    close: () => {
      queue.length = 0
      handle.close()
    },
  }
}

// ---------- version / clash-mode(config) ----------

export const fetchSingboxVersion = async () => {
  const client = getSingboxClient()?.client
  if (!client) return { data: { version: 'sing-box' } }
  const v = await client.getVersion({})
  const version = v.version.includes('sing-box') ? v.version : `sing-box ${v.version}`
  return { data: { version } }
}

const defaultConfig: Config = {
  port: 0,
  'socks-port': 0,
  'redir-port': 0,
  'tproxy-port': 0,
  'mixed-port': 0,
  'allow-lan': false,
  'bind-address': '',
  mode: '',
  'mode-list': [],
  modes: [],
  'log-level': '',
  ipv6: false,
  tun: { enable: false },
}

export const fetchSingboxConfigs = async (): Promise<Config> => {
  const client = getSingboxClient()?.client
  if (!client) return { ...defaultConfig }
  const status = await client.getClashModeStatus({})
  return {
    ...defaultConfig,
    mode: status.currentMode,
    'mode-list': status.modeList,
    modes: status.modeList,
  }
}

export const setSingboxClashMode = async (mode: string) => {
  const client = getSingboxClient()?.client
  if (!client) return
  await client.setClashMode({ mode })
}
