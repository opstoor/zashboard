// view 侧据 channel 类型动态选择代理「组装逻辑」的入口。
// clash 后端 → store/proxiesClash;sing-box native 后端 → store/proxiesSingbox。
// 组件从这里 import 动作即可,内部按需 dynamic import 对应实现(首次加载后缓存)。

import { isSingboxBackend } from '@/composables/backendCapability'

interface ProxiesAssembly {
  fetchProxies: () => Promise<unknown>
  handlerProxySelect: (proxyGroupName: string, proxyName: string) => Promise<unknown>
  proxyLatencyTest: (
    proxyName: string,
    url?: string,
    timeout?: number,
    groupName?: string,
  ) => Promise<unknown>
  proxyGroupLatencyTest: (proxyGroupName: string) => Promise<unknown>
  allProxiesLatencyTest: () => Promise<unknown>
}

const loadAssembly = (): Promise<ProxiesAssembly> =>
  isSingboxBackend.value ? import('@/store/proxiesSingbox') : import('@/store/proxiesClash')

export const fetchProxies = async () => (await loadAssembly()).fetchProxies()

export const handlerProxySelect = async (proxyGroupName: string, proxyName: string) =>
  (await loadAssembly()).handlerProxySelect(proxyGroupName, proxyName)

export const proxyLatencyTest = async (
  proxyName: string,
  url?: string,
  timeout?: number,
  groupName?: string,
) => (await loadAssembly()).proxyLatencyTest(proxyName, url, timeout, groupName)

export const proxyGroupLatencyTest = async (proxyGroupName: string) =>
  (await loadAssembly()).proxyGroupLatencyTest(proxyGroupName)

export const allProxiesLatencyTest = async () => (await loadAssembly()).allProxiesLatencyTest()

// 后端切换 / 登出时丢弃 sing-box 订阅(clash 无需处理)。
export const resetProxiesAssembly = async () => {
  const m = await import('@/store/proxiesSingbox')
  m.resetProxies()
}
