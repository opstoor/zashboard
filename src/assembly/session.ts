import { PROXY_TAB_TYPE, RULE_TAB_TYPE } from '@/constant'
import { initConnections, stopConnections } from '@/store/connections'
import { initSatistic, stopSatistic } from '@/store/overview'
import { activeBackend } from '@/store/setup'
import { watch } from 'vue'
import { fetchConfigs } from './config'
import { initLogs, stopLogs } from './logs'
import { fetchProxies, proxiesTabShow } from './proxies'
import { fetchRules, rulesTabShow } from './rules'
import { probeActiveBackend } from './version'

export const startBackendSession = () => {
  probeActiveBackend()
  stopConnections()
  stopLogs()
  stopSatistic()

  if (!activeBackend.value) return

  rulesTabShow.value = RULE_TAB_TYPE.RULES
  proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES
  fetchConfigs()
  fetchProxies()
  fetchRules()
  initConnections()
  initLogs()
  initSatistic()
}

watch(activeBackend, startBackendSession, { immediate: true })
