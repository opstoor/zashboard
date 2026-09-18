import { can } from '@/assembly/backend'
import { NOT_CONNECTED, PROXY_TAB_TYPE, PROXY_TYPE, TEST_URL } from '@/constant'
import { notifyRequestError } from '@/helper/requestError'
import { useStorage } from '@/helper/storage'
import { groupTestUrls, independentLatencyTest, speedtestUrl } from '@/store/settings'
import type { Proxy, ProxyProvider } from '@/types'
import { last } from 'lodash'
import { computed, effectScope, ref, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import * as clash from './clash'

export const proxiesFilter = ref('')
export const proxiesTabShow = ref(PROXY_TAB_TYPE.PROXIES)

export const proxyGroupList = ref<string[]>([])
export const proxyMap = ref<Record<string, Proxy>>({})
export const IPv6Map = useStorage<Record<string, boolean>>('cache/ipv6-map', {})
export const hiddenGroupMap = useStorage<Record<string, boolean>>('config/hidden-group-map', {})
export const proxyProviederList = ref<ProxyProvider[]>([])

export type LatencyMap = Map<string, number>

export const speedtestUrlWithDefault = computed(() => {
  return speedtestUrl.value || TEST_URL
})

export const getTestUrl = (groupName?: string) => {
  if (!groupName || !independentLatencyTest.value) {
    return speedtestUrlWithDefault.value
  }

  const groupTestUrl = groupTestUrls.value.find((item) => item.name === groupName)

  if (groupTestUrl) {
    return groupTestUrl.url
  }

  const proxyNode =
    proxyMap.value[groupName] || proxyProviederList.value.find((p) => p.name === groupName)

  return proxyNode?.testUrl || speedtestUrlWithDefault.value
}

export const getLatencyFromHistory = (history?: Proxy['history']) => {
  return last(history)?.delay ?? NOT_CONNECTED
}

const DEFAULT_TEST_URL_BUCKET = ''

const latencyMapCache = new Map<string, ComputedRef<LatencyMap>>()

const readHistory = (proxyName: string, testUrl: string) => {
  const proxyNode = proxyMap.value[proxyName]

  if (testUrl !== DEFAULT_TEST_URL_BUCKET) {
    if (!proxyNode) {
      return undefined
    }

    if (proxyNode.extra) {
      return proxyNode.extra[testUrl]?.history
    }
  }

  return proxyMap.value[getNowProxyNodeName(proxyName)]?.history
}

const latencyScope = effectScope(true)

const getLatencyMap = (testUrl: string) => {
  let latencyMap = latencyMapCache.get(testUrl)

  if (!latencyMap) {
    latencyMap = latencyScope.run(() =>
      computed(() => {
        const result: LatencyMap = new Map()

        for (const name of Object.keys(proxyMap.value)) {
          result.set(name, getLatencyFromHistory(readHistory(name, testUrl)))
        }

        return result
      }),
    )!
    latencyMapCache.set(testUrl, latencyMap)
  }

  return latencyMap
}

const getTestUrlBucket = (groupName?: string) => {
  if (groupName && independentLatencyTest.value && can('independentLatency')) {
    return getTestUrl(groupName)
  }

  return DEFAULT_TEST_URL_BUCKET
}

export const latencyMapOf = (groupName?: MaybeRefOrGetter<string | undefined>) =>
  computed(() => getLatencyMap(getTestUrlBucket(toValue(groupName))).value)

export const getLatencyByName = (proxyName: string, groupName?: string) => {
  return getLatencyMap(getTestUrlBucket(groupName)).value.get(proxyName) ?? NOT_CONNECTED
}

export const getHistoryByName = (proxyName: string, groupName?: string) => {
  if (groupName && independentLatencyTest.value && can('independentLatency')) {
    const proxyNode = proxyMap.value[proxyName]
    const url = getTestUrl(groupName)

    if (!proxyNode) {
      return []
    }

    if (!proxyNode?.extra) {
      const nowNode = proxyMap.value[getNowProxyNodeName(proxyName)]

      return nowNode?.history
    }

    if (!proxyNode.extra?.[url]) {
      proxyNode.extra[url] = {
        history: [],
        alive: true,
      }
    }

    return proxyNode?.extra?.[url]?.history
  }

  const nowNode = proxyMap.value[getNowProxyNodeName(proxyName)]

  return nowNode?.history
}

export const getIPv6ByName = (proxyName: string) => {
  return IPv6Map.value[getNowProxyNodeName(proxyName)]
}

export const getNowProxyNodeName = (name: string) => {
  let node = proxyMap.value[name]

  if (!name || !node) {
    return name
  }

  while (node.now && node.now !== node.name) {
    const nextNode = proxyMap.value[node.now]

    if (!nextNode) {
      return node.name
    }

    node = nextNode
  }

  return node.name
}

export const getProxyGroupChains = (name: string) => {
  let proxyNode = proxyMap.value[name]

  if (!proxyNode) {
    return []
  }

  const result = [name]

  while (
    proxyNode.now &&
    proxyNode.now !== proxyNode.name &&
    proxyGroupList.value.includes(proxyNode.now)
  ) {
    result.push(proxyNode.now)
    proxyNode = proxyMap.value[proxyNode.now]
  }
  return result
}

export const hasSmartGroup = computed(() => {
  return Object.values(proxyMap.value).some(
    (proxy) => proxy.type.toLowerCase() === PROXY_TYPE.Smart,
  )
})

export const fetchProxies = () => clash.fetchProxies()

export const handlerProxySelect = async (proxyGroupName: string, proxyName: string) => {
  try {
    return await clash.handlerProxySelect(proxyGroupName, proxyName)
  } catch (e) {
    notifyRequestError(e)
  }
}

export const proxyLatencyTest = (proxyName: string, url?: string, timeout?: number) =>
  clash.proxyLatencyTest(proxyName, url, timeout)

export const proxyGroupLatencyTest = (proxyGroupName: string) =>
  clash.proxyGroupLatencyTest(proxyGroupName)

export const allProxiesLatencyTest = () => clash.allProxiesLatencyTest()

export {
  fetchSmartWeightsAPI,
  flushSmartGroupWeightsAPI,
  proxyProviderHealthCheckAPI,
  updateProxyProviderAPI,
} from '@/api/clash'
