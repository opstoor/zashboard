// Adapters that expose the sing-box native SubscribeStatus gRPC stream through
// the same `{ data, close }` shape that the Clash WebSocket factories return,
// so the statistics (memory / traffic) store can consume it without changes.

import type { Status } from '@/gen/daemon/started_service_pb'
import { ref, type Ref } from 'vue'
import { getSingboxClient } from './client'
import { runStream, type StreamHandle } from './streams'

// SubscribeStatus reports at this interval (1s in ns), matching the cadence of
// the Clash traffic/memory WebSockets.
const SUBSCRIPTION_INTERVAL = 1_000_000_000n

export interface SingboxSubscription<T> {
  data: Ref<T | undefined>
  close: () => void
}

type StatusListener = (status: Status) => void

const statusListeners = new Set<StatusListener>()
let statusHandle: StreamHandle | null = null
let latestStatus: Status | null = null

const closeSharedStatusStream = () => {
  statusHandle?.close()
  statusHandle = null
  latestStatus = null
}

const ensureSharedStatusStream = () => {
  if (statusHandle) return true

  const client = getSingboxClient()?.client
  if (!client) return false

  statusHandle = runStream(
    (signal) => client.subscribeStatus({ interval: SUBSCRIPTION_INTERVAL }, { signal }),
    (status) => {
      latestStatus = status
      statusListeners.forEach((listener) => listener(status))
    },
  )

  return true
}

const subscribeSingboxStatus = <T>(map: (status: Status) => T): SingboxSubscription<T> | null => {
  const data = ref<T>()
  const listener: StatusListener = (status) => {
    data.value = map(status)
  }

  statusListeners.add(listener)
  if (!ensureSharedStatusStream()) {
    statusListeners.delete(listener)
    return null
  }
  if (latestStatus) listener(latestStatus)

  return {
    data,
    close: () => {
      statusListeners.delete(listener)
      if (statusListeners.size === 0) closeSharedStatusStream()
    },
  }
}

export const subscribeSingboxMemory = (): SingboxSubscription<{
  inuse: number
  goroutines: number
}> | null =>
  subscribeSingboxStatus((status) => ({
    inuse: Number(status.memory),
    goroutines: status.goroutines,
  }))

export const subscribeSingboxTraffic = (): SingboxSubscription<{
  down: number
  up: number
}> | null =>
  subscribeSingboxStatus((status) => ({
    down: Number(status.downlink),
    up: Number(status.uplink),
  }))
