import { probeClashChannel } from '@/api/clash'
import type { ProbeResult } from '@/helper/connectivity'
import { displayAllFeatures } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import type { Backend } from '@/types'
import { computed, ref } from 'vue'

export enum Core {
  Mihomo = 'mihomo',
  Honk = 'honk',
  Unknown = 'unknown',
}

export const core = ref<Core>(Core.Unknown)

export const resetCore = () => {
  core.value = Core.Unknown
}

const isNonMihomoCore = computed(() => core.value === Core.Honk)

const isForkCoreOverride = computed(() => isNonMihomoCore.value && displayAllFeatures.value)

export const showDisplayAllFeatures = computed(() => !!activeBackend.value && isNonMihomoCore.value)

const soft = computed(() => {
  const mihomo = core.value === Core.Mihomo
  const honk = core.value === Core.Honk
  const mihomoOrForkCore = mihomo || isForkCoreOverride.value

  return {
    coreUpgrade: mihomoOrForkCore,
    coreRestart: mihomoOrForkCore,
    dashboardUpgrade: mihomoOrForkCore,
    reloadConfigs: mihomoOrForkCore,
    updateConfigs: mihomoOrForkCore,
    updateGeoDatabase: mihomoOrForkCore,
    syncSettings: mihomoOrForkCore,
    independentLatency: mihomoOrForkCore,
    coreUpdateCheck: mihomo,
    configPatch: mihomo,

    traceLogLevel: honk,
    silentLogLevel: mihomo,

    runtimeStats: honk,
  }
})

export type Cap = keyof typeof soft.value

export const can = (cap: Cap): boolean => {
  if (!activeBackend.value) return false

  return soft.value[cap]
}

export const probeBackend = async (
  backend: Backend,
  timeout: number = 10000,
  signal?: AbortSignal,
): Promise<ProbeResult> => probeClashChannel(backend, timeout, signal)

export const isBackendAvailable = (backend: Backend, timeout: number = 10000) =>
  probeBackend(backend, timeout).then((result) => result.ok)
