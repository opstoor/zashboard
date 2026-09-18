import { activeBackend } from '@/store/setup'
import { watch } from 'vue'
import { fetchConfigs } from './config'
import { initConnections, stopConnections } from './connections'
import { initLogs, stopLogs } from './logs'
import { initSatistic, stopSatistic } from './overview'
import { fetchProxies } from './proxies'
import { fetchRules } from './rules'
import { probeActiveBackend } from './version'

export const startBackendSession = () => {
  probeActiveBackend()
  stopConnections()
  stopLogs()
  stopSatistic()

  if (!activeBackend.value) return

  fetchConfigs()
  fetchProxies()
  fetchRules()
  initConnections()
  initLogs()
  initSatistic()
}

watch(activeBackend, startBackendSession, { immediate: true })
