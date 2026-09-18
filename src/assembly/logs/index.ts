import { can, core, Core } from '@/assembly/backend'
import { LOG_LEVEL } from '@/constant'
import { useStorage } from '@/helper/storage'
import { activeBackend } from '@/store/setup'
import type { LogWithSeq } from '@/types'
import { computed, ref, shallowRef, watch } from 'vue'
import { createLogsAccumulator } from './accumulator'
import * as clash from './clash'

export const logs = shallowRef<LogWithSeq[]>([])
export const isPaused = ref(false)
export const logLevel = useStorage<string>('config/log-level', LOG_LEVEL.Info)

export const supportedLogLevels = computed(() => {
  const levels = [LOG_LEVEL.Debug, LOG_LEVEL.Info, LOG_LEVEL.Warning, LOG_LEVEL.Error]

  if (can('traceLogLevel')) levels.unshift(LOG_LEVEL.Trace)
  if (can('silentLogLevel')) levels.push(LOG_LEVEL.Silent)

  return levels
})

watch(supportedLogLevels, (levels) => {
  if (!activeBackend.value || core.value === Core.Unknown) return
  if (levels.includes(logLevel.value as LOG_LEVEL)) return

  logLevel.value = LOG_LEVEL.Info
  if (cancel) initLogs()
})

let cancel: (() => void) | undefined

export const initLogs = () => {
  stopLogs()

  const accumulator = createLogsAccumulator(logs, () => isPaused.value)
  const subscription = clash.subscribeLogs({ level: logLevel.value }, accumulator.push)

  cancel = () => {
    accumulator.dispose()
    subscription.close()
  }
}

export const stopLogs = () => {
  cancel?.()
  cancel = undefined
  logs.value = []
}
