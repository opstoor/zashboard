import { useStorage } from '@/helper/storage'
import { ref } from 'vue'

export { initLogs, isPaused, logLevel, logs, stopLogs, supportedLogLevels } from '@/assembly/logs'

export const logFilter = ref('')
export const logTypeFilter = ref('')
export const logFilterRegex = useStorage<string>('config/log-filter-regex', '')
export const logFilterEnabled = useStorage<boolean>('config/log-filter-enabled', false)
