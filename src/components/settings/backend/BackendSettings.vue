<template>
  <!-- backend -->
  <div
    v-if="hasVisibleItems"
    class="flex flex-col gap-3 text-sm"
  >
    <div class="flex items-center gap-2 px-1">
      <div class="indicator">
        <span
          v-if="isCoreUpdateAvailable"
          class="indicator-item top-1 -right-1 flex"
        >
          <span class="bg-secondary absolute h-2 w-2 animate-ping rounded-full"></span>
          <span class="bg-secondary h-2 w-2 rounded-full"></span>
        </span>
        <a
          class="flex cursor-pointer items-center gap-2 text-lg font-semibold"
          :href="
            isSingBoxCore
              ? 'https://github.com/sagernet/sing-box'
              : MIHOMO_CHANNEL[mihomo?.[0] ?? MIHOMO.Meta].url
          "
          target="_blank"
        >
          {{ $t('backend') }}
          <BackendVersion class="text-sm font-normal" />
        </a>
      </div>
    </div>

    <div
      class="settings-grid"
      v-if="isVisibleActions || isVisibleBackendSwitch || isVisibleDnsQuery"
    >
      <SettingItem
        :setting-key="k.backend"
        class="p-4"
      >
        <BackendSwitch />
      </SettingItem>

      <div
        v-if="isVisibleActions && !isSingboxBackend"
        class="relative"
        :class="settingsEditMode && isSettingHidden(k.actions) ? 'opacity-40' : ''"
      >
        <SettingVisibilityToggle
          :setting-key="k.actions"
          class="absolute top-2 left-2 z-10"
        />
        <div class="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-2">
          <template v-if="!isSingBoxCore || displayAllFeatures">
            <button
              v-if="!activeBackend?.disableUpgradeCore"
              class="btn btn-neutral btn-sm"
              @click="showUpgradeCoreModal = true"
            >
              {{ $t('upgradeCore') }}
            </button>
            <button
              class="btn btn-sm"
              @click="handlerClickRestartCore"
            >
              <span
                v-if="isCoreRestarting"
                class="loading loading-spinner loading-md"
              ></span>
              {{ $t('restartCore') }}
            </button>
            <button
              class="btn btn-sm"
              @click="handlerClickReloadConfigs"
            >
              <span
                v-if="isConfigReloading"
                class="loading loading-spinner loading-md"
              ></span>
              {{ $t('reloadConfigs') }}
            </button>
            <button
              v-if="!isSingBoxCore"
              class="btn btn-sm"
              @click="showUpdateConfigModal = true"
            >
              {{ $t('updateConfigs') }}
            </button>
            <button
              class="btn btn-sm"
              @click="handlerClickUpdateGeo"
            >
              <span
                v-if="isGeoUpdating"
                class="loading loading-spinner loading-md"
              ></span>
              {{ $t('updateGeoDatabase') }}
            </button>
          </template>
          <button
            class="btn btn-sm"
            @click="handleFlushDNSCache"
          >
            {{ $t('flushDNSCache') }}
          </button>
          <button
            class="btn btn-sm"
            @click="handleFlushFakeIP"
          >
            {{ $t('flushFakeIP') }}
          </button>
          <button
            v-if="hasSmartGroup"
            class="btn btn-sm"
            @click="handleFlushSmartWeights"
          >
            {{ $t('flushSmartWeights') }}
          </button>
        </div>
      </div>

      <SettingItem
        :setting-key="k.DNSQuery"
        :when="!isSingboxBackend"
        class="py-3"
      >
        <div class="flex w-full flex-col">
          <div class="settings-section-label">
            {{ $t('DNSQuery') }}
          </div>
          <DnsQuery />
        </div>
      </SettingItem>
    </div>

    <div
      v-if="!isSingBoxCore && configs && hasVisibleSettings"
      class="grid"
    >
      <div class="settings-section-label">
        {{ $t('settings') }}
      </div>
      <div class="settings-grid">
        <div
          v-if="isVisiblePorts"
          class="relative"
          :class="settingsEditMode && isSettingHidden(k.ports) ? 'opacity-40' : ''"
        >
          <SettingVisibilityToggle
            :setting-key="k.ports"
            class="absolute top-1 right-1 z-10"
          />
          <BackendPortsGrid />
        </div>
        <div
          v-if="configs?.tun && canShowTunMode"
          class="setting-item"
        >
          <SettingVisibilityToggle :setting-key="k.tunMode" />
          <div class="setting-item-label">
            {{ $t('tunMode') }}
          </div>
          <input
            class="toggle"
            type="checkbox"
            v-model="configs.tun.enable"
            @change="hanlderTunModeChange"
          />
        </div>
        <div
          v-if="configs && isVisibleAllowLan"
          class="setting-item"
        >
          <SettingVisibilityToggle :setting-key="k.allowLan" />
          <div class="setting-item-label">
            {{ $t('allowLan') }}
          </div>
          <input
            class="toggle"
            type="checkbox"
            v-model="configs['allow-lan']"
            @change="handlerAllowLanChange"
          />
        </div>
        <template v-if="!activeBackend?.disableUpgradeCore">
          <SettingItem :setting-key="k.checkCoreUpgrade">
            <div class="setting-item-label">
              {{ $t('checkCoreUpgrade') }}
            </div>
            <input
              class="toggle"
              type="checkbox"
              v-model="checkUpgradeCore"
              @change="handlerCheckUpgradeCoreChange"
            />
          </SettingItem>
          <SettingItem
            :setting-key="k.autoUpgradeCore"
            :when="checkUpgradeCore"
          >
            <div class="setting-item-label">
              {{ $t('autoUpgradeCore') }}
            </div>
            <input
              class="toggle"
              type="checkbox"
              v-model="autoUpgradeCore"
            />
          </SettingItem>
        </template>
      </div>
    </div>

    <UpgradeCoreModal v-model="showUpgradeCoreModal" />
    <UpdateConfigModal v-model="showUpdateConfigModal" />
  </div>
</template>

<script setup lang="ts">
import {
  flushDNSCacheAPI,
  flushFakeIPAPI,
  reloadConfigsAPI,
  updateGeoDataAPI,
} from '@/assembly/config'
import { isCoreUpdateAvailable, isSingBoxCore, mihomo, restartCoreAPI } from '@/assembly/version'
import BackendVersion from '@/components/common/BackendVersion.vue'
import BackendPortsGrid from '@/components/settings/backend/BackendPortsGrid.vue'
import BackendSwitch from '@/components/settings/backend/BackendSwitch.vue'
import DnsQuery from '@/components/settings/backend/DnsQuery.vue'
import { isSingboxBackend } from '@/assembly/backend'
import SettingItem from '@/components/settings/SettingItem.vue'
import SettingVisibilityToggle from '@/components/settings/SettingVisibilityToggle.vue'
import { isSettingHidden, settingsEditMode, useIsSettingVisible } from '@/composables/settings'
import { BACKEND_ITEM_KEYS } from '@/config/settingsItems'
import { MIHOMO, MIHOMO_CHANNEL } from '@/constant'
import { showNotification } from '@/helper/notification'
import { fetchProxies, flushSmartGroupWeightsAPI } from '@/assembly/proxies'
import { configs, fetchConfigs, updateConfigs } from '@/assembly/config'
import { hasSmartGroup } from '@/assembly/proxies'
import { fetchRules } from '@/assembly/rules'
import { autoUpgradeCore, checkUpgradeCore, displayAllFeatures } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import { computed, ref } from 'vue'
import UpdateConfigModal from './UpdateConfigModal.vue'
import UpgradeCoreModal from './UpgradeCoreModal.vue'

const k = BACKEND_ITEM_KEYS
const isVisibleBackendSwitch = useIsSettingVisible(k.backend)
const isVisiblePorts = useIsSettingVisible(k.ports)
const isVisibleTunMode = useIsSettingVisible(k.tunMode)
const isVisibleAllowLan = useIsSettingVisible(k.allowLan)
const isVisibleCheckUpgrade = useIsSettingVisible(k.checkCoreUpgrade)
const isVisibleAutoUpgrade = useIsSettingVisible(k.autoUpgradeCore)
const isVisibleActions = useIsSettingVisible(k.actions)
const isVisibleDnsQuery = useIsSettingVisible(k.DNSQuery)
const canShowTunMode = computed(
  () => isVisibleTunMode.value && !activeBackend.value?.disableTunMode,
)

const hasVisibleItems = computed(() => {
  return (
    isVisibleBackendSwitch.value ||
    hasVisibleSettings.value ||
    isVisibleActions.value ||
    isVisibleDnsQuery.value
  )
})

const hasVisibleSettings = computed(() => {
  return (
    !isSingBoxCore.value &&
    !!configs.value &&
    (isVisiblePorts.value ||
      (configs.value.tun && canShowTunMode.value) ||
      isVisibleAllowLan.value ||
      (!activeBackend.value?.disableUpgradeCore &&
        (isVisibleCheckUpgrade.value || (checkUpgradeCore.value && isVisibleAutoUpgrade.value))))
  )
})

const reloadAll = () => {
  fetchConfigs()
  fetchRules()
  fetchProxies()
}

const showUpgradeCoreModal = ref(false)
const showUpdateConfigModal = ref(false)

const isCoreRestarting = ref(false)
const handlerClickRestartCore = async () => {
  if (isCoreRestarting.value) return
  isCoreRestarting.value = true
  try {
    await restartCoreAPI()
    setTimeout(() => {
      reloadAll()
    }, 500)
    isCoreRestarting.value = false
    showNotification({
      content: 'restartCoreSuccess',
      type: 'alert-success',
    })
  } catch {
    isCoreRestarting.value = false
  }
}

const isConfigReloading = ref(false)
const handlerClickReloadConfigs = async () => {
  if (isConfigReloading.value) return
  isConfigReloading.value = true
  try {
    await reloadConfigsAPI()
    reloadAll()
    isConfigReloading.value = false
    showNotification({
      content: 'reloadConfigsSuccess',
      type: 'alert-success',
    })
  } catch {
    isConfigReloading.value = false
  }
}

const isGeoUpdating = ref(false)
const handlerClickUpdateGeo = async () => {
  if (isGeoUpdating.value) return
  isGeoUpdating.value = true
  try {
    await updateGeoDataAPI()
    reloadAll()
    isGeoUpdating.value = false
    showNotification({
      content: 'updateGeoSuccess',
      type: 'alert-success',
    })
  } catch {
    isGeoUpdating.value = false
  }
}

const handlerCheckUpgradeCoreChange = () => {
  if (!checkUpgradeCore.value) {
    autoUpgradeCore.value = false
    isCoreUpdateAvailable.value = false
  }
}

const hanlderTunModeChange = async () => {
  await updateConfigs({ tun: { enable: configs.value?.tun.enable } })
}
const handlerAllowLanChange = async () => {
  await updateConfigs({ ['allow-lan']: configs.value?.['allow-lan'] })
}

const handleFlushDNSCache = async () => {
  await flushDNSCacheAPI()
  showNotification({
    content: 'flushDNSCacheSuccess',
    type: 'alert-success',
  })
}

const handleFlushFakeIP = async () => {
  await flushFakeIPAPI()
  showNotification({
    content: 'flushFakeIPSuccess',
    type: 'alert-success',
  })
}

const handleFlushSmartWeights = async () => {
  await flushSmartGroupWeightsAPI()
  showNotification({
    content: 'flushSmartWeightsSuccess',
    type: 'alert-success',
  })
}
</script>
