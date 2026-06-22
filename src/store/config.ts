import { getConfigsAPI, patchConfigsAPI } from '@/api'
import { fetchSingboxConfigs, setSingboxClashMode } from '@/api/singbox/adapter'
import { isSingboxBackend } from '@/composables/backendCapability'
import type { Config } from '@/types'
import { ref } from 'vue'

export const configs = ref<Config>({
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
  tun: {
    enable: false,
  },
})
export const fetchConfigs = async () => {
  if (isSingboxBackend.value) {
    // sing-box native 仅暴露 clash-mode,其余配置项保持默认。
    configs.value = await fetchSingboxConfigs()
    return
  }
  configs.value = (await getConfigsAPI()).data
}
export const updateConfigs = async (cfg: Record<string, string | boolean | object | number>) => {
  if (isSingboxBackend.value) {
    if (typeof cfg.mode === 'string') await setSingboxClashMode(cfg.mode)
    fetchConfigs()
    return
  }
  await patchConfigsAPI(cfg)
  fetchConfigs()
}
