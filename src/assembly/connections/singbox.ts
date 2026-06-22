// sing-box native 后端的连接组装:订阅 gRPC SubscribeConnections,把 protobuf 事件
// 维护成一张连接表,按 100ms 批量产出与 Clash WS 相同形状的 { data, close } 流。
import { getSingboxClient } from '@/api/singbox/client'
import { runStream, type StreamHandle } from '@/api/singbox/streams'
import {
  ConnectionEventType,
  type Connection as PbConnection,
} from '@/gen/daemon/started_service_pb'
import type { ConnectionRawMessage } from '@/types'
import { ref, type Ref } from 'vue'

const SUBSCRIPTION_INTERVAL = 1_000_000_000n // 1s(ns)

interface SingboxStream<T> {
  data: Ref<T | undefined>
  close: () => void
}

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

const fetchSingboxConnections = <T>(): SingboxStream<T> => {
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

const closeSingboxConnection = async (id: string) => {
  const client = getSingboxClient()?.client
  if (!client) return
  await client.closeConnection({ id })
}

const closeAllSingboxConnections = async () => {
  const client = getSingboxClient()?.client
  if (!client) return
  await client.closeAllConnections({})
}

export const disconnectByIdAPI = closeSingboxConnection

export const disconnectAllAPI = closeAllSingboxConnections

export const fetchConnectionsAPI = fetchSingboxConnections
