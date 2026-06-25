// sing-box native 后端的日志订阅:订阅 gRPC SubscribeLog,保留 ANSI 颜色码、映射日志级别。
// 日志本就按批到达,这里直接整批产出(不再伪装成 Clash 那样逐条投递)。
import { getSingboxClient } from '@/api/singbox/client'
import { runStream } from '@/api/singbox/streams'
import { LogLevel } from '@/gen/daemon/started_service_pb'
import type { Log } from '@/types'
import type { LogsSubscription } from './types'

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

export const subscribeLogs = (
  params: Record<string, string>,
  onBatch: (batch: Log[]) => void,
): LogsSubscription => {
  const client = getSingboxClient()?.client
  if (!client) return { close: () => {} }

  const levelFilter = logLevelFilterFromParam(params.level)

  const handle = runStream(
    (signal) => client.subscribeLog({}, { signal }),
    (msg) => {
      const batch: Log[] = []
      for (const m of msg.messages) {
        if (levelFilter === null || (levelFilter !== undefined && m.level > levelFilter)) continue
        batch.push({ type: logLevelToType(m.level), payload: m.message })
      }
      if (batch.length) onBatch(batch)
    },
  )

  return { close: () => handle.close() }
}
