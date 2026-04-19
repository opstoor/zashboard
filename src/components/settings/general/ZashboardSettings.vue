<template>
  <div class="relative flex flex-col text-sm">
    <div class="flex items-center gap-2 px-1">
      <div class="indicator">
        <span
          v-if="isUIUpdateAvailable"
          class="indicator-item top-1 -right-1 flex"
        >
          <span class="bg-secondary absolute h-2 w-2 animate-ping rounded-full"></span>
          <span class="bg-secondary h-2 w-2 rounded-full"></span>
        </span>
        <a
          href="https://github.com/Zephyruso/zashboard"
          target="_blank"
          class="text-lg font-semibold"
        >
          zashboard
          <span class="text-sm font-normal opacity-50">
            {{ zashboardVersion }}
            <span
              v-if="commitId"
              class="text-xs"
            >
              {{ commitId }}
            </span>
          </span>
        </a>
      </div>
    </div>

    <div
      v-if="isVisibleActions"
      class="settings-grid my-3 gap-2 p-3 md:grid-cols-2!"
    >
      <button
        :class="twMerge('btn btn-neutral btn-sm', isUIUpgrading ? 'animate-pulse' : '')"
        @click="handlerClickUpgradeUI"
      >
        {{ $t('upgradeDashboard') }}
      </button>
      <button
        class="btn btn-sm"
        @click="handlerClickResetSettings"
      >
        {{ $t('resetSettings') }}
      </button>
      <button
        v-if="!isSingBox || displayAllFeatures"
        class="btn btn-sm"
        @click="isStorageSettingsModalOpen = true"
      >
        {{ $t('syncSettingsTitle') }}
      </button>
      <ImportSettings />
    </div>

    <DialogWrapper
      v-model="isStorageSettingsModalOpen"
      :title="$t('syncSettingsTitle')"
    >
      <div class="flex min-w-64 flex-col gap-2">
        <button
          :class="twMerge('btn btn-sm', isStorageSubmitting ? 'btn-disabled' : '')"
          :disabled="isStorageSubmitting"
          @click="handlerClickUploadSettings"
        >
          {{ $t('uploadSettings') }}
        </button>
        <button
          :class="twMerge('btn btn-sm', isStorageSubmitting ? 'btn-disabled' : '')"
          :disabled="isStorageSubmitting"
          @click="handlerClickSyncSettings"
        >
          {{ $t('syncSettings') }}
        </button>
        <button
          :class="
            twMerge('btn btn-sm btn-error btn-soft', isStorageSubmitting ? 'btn-disabled' : '')
          "
          :disabled="isStorageSubmitting"
          @click="handlerClickDeleteUploadedSettings"
        >
          {{ $t('deleteUploadedSettings') }}
        </button>
        <div class="mt-2 flex items-center gap-2">
          <label class="flex cursor-pointer items-center gap-2">
            <span>{{ $t('autoSyncSettings') }}</span>
            <input
              v-model="autoSyncSettings"
              type="checkbox"
              class="toggle toggle-sm"
            />
          </label>
        </div>
      </div>
    </DialogWrapper>

    <StyleSettings />
    <GeneralSettings />
  </div>
</template>

<script setup lang="ts">
import { deleteStorageAPI, isSingBox, setStorageAPI, upgradeUIAPI, zashboardVersion } from '@/api'
import { useIsSettingVisible, useSettings } from '@/composables/settings'
import { GENERAL_ITEM_KEYS } from '@/config/settingsItems'
import { handlerUpgradeSuccess } from '@/helper'
import { autoSyncSettings, syncSettingsFromCore } from '@/helper/autoImportSettings'
import { showNotification } from '@/helper/notification'
import { getDashboardSettingsFromStorage, resetSettings } from '@/helper/utils'
import { displayAllFeatures } from '@/store/settings'
import { twMerge } from 'tailwind-merge'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogWrapper from '../../common/DialogWrapper.vue'
import ImportSettings from '../../common/ImportSettings.vue'
import GeneralSettings from './GeneralSettings.vue'
import StyleSettings from './StyleSettings.vue'

const k = GENERAL_ITEM_KEYS
const isVisibleActions = useIsSettingVisible(k.actions)

const commitId = __COMMIT_ID__

const { isUIUpdateAvailable } = useSettings()
const { t } = useI18n()

const isUIUpgrading = ref(false)
const isStorageSubmitting = ref(false)
const isStorageSettingsModalOpen = ref(false)

const handlerClickResetSettings = () => {
  if (!window.confirm(t('resetSettingsConfirm'))) return
  resetSettings()
}

const handlerClickUpgradeUI = async () => {
  if (isUIUpgrading.value) return
  isUIUpgrading.value = true
  try {
    await upgradeUIAPI()
    isUIUpgrading.value = false
    handlerUpgradeSuccess()
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } catch {
    isUIUpgrading.value = false
  }
}

const handlerClickUploadSettings = async () => {
  if (isStorageSubmitting.value) return

  isStorageSubmitting.value = true
  try {
    await setStorageAPI(getDashboardSettingsFromStorage())
    isStorageSettingsModalOpen.value = false
    showNotification({
      content: 'uploadSettingsSuccess',
      type: 'alert-success',
    })
  } finally {
    isStorageSubmitting.value = false
  }
}

const handlerClickSyncSettings = async () => {
  if (isStorageSubmitting.value) return

  isStorageSubmitting.value = true
  try {
    isStorageSettingsModalOpen.value = false
    await syncSettingsFromCore({
      force: true,
      notify: true,
    })
  } finally {
    isStorageSubmitting.value = false
  }
}

const handlerClickDeleteUploadedSettings = async () => {
  if (isStorageSubmitting.value) return
  if (!window.confirm(t('deleteUploadedSettingsConfirm'))) return

  isStorageSubmitting.value = true
  try {
    await deleteStorageAPI()
    isStorageSettingsModalOpen.value = false
    showNotification({
      content: 'deleteUploadedSettingsSuccess',
      type: 'alert-success',
    })
  } finally {
    isStorageSubmitting.value = false
  }
}

watch(autoSyncSettings, async (value, oldValue) => {
  if (!value || oldValue || isStorageSubmitting.value) return

  isStorageSubmitting.value = true
  try {
    isStorageSettingsModalOpen.value = false
    await syncSettingsFromCore()
  } finally {
    isStorageSubmitting.value = false
  }
})
</script>
