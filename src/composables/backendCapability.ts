import { activeBackend } from '@/store/setup'
import { computed } from 'vue'

// 当前后端是否为 sing-box native(gRPC)登录。
export const isSingboxBackend = computed(() => activeBackend.value?.type === 'singbox')

// Clash 通道:非 sing-box 的常规后端。
export const hasClashChannel = computed(() => !!activeBackend.value && !isSingboxBackend.value)

// sing-box native 通道:供 Tools / ChartsCard(goroutines)等使用。
export const hasSingboxChannel = computed(() => isSingboxBackend.value)

// 各页面能力门控。sing-box native 暂不支持 rules/providers/dns/smart/内核升级。
export const capabilities = computed(() => ({
  proxies: !!activeBackend.value,
  connections: !!activeBackend.value,
  logs: !!activeBackend.value,
  overview: !!activeBackend.value,
  rules: hasClashChannel.value,
  providers: hasClashChannel.value,
  dns: hasClashChannel.value,
  smart: hasClashChannel.value,
  upgrade: hasClashChannel.value,
  tools: isSingboxBackend.value,
}))
