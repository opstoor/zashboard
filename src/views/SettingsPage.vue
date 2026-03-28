<template>
  <div
    class="relative h-full overflow-y-auto"
    @scroll.passive="handleScroll"
    ref="scrollContainerRef"
  >
    <SettingsMenu
      :menu-items="menuItems"
      :active-menu-key="activeMenuKey"
      @menu-click="handleMenuClick"
    />

    <button
      v-if="isPWA"
      class="btn btn-ghost btn-sm absolute top-14 right-2 z-10"
      @click="refreshPages"
    >
      <ArrowPathIcon class="h-4 w-4" />
      {{ $t('refresh') }}
    </button>

    <!-- Content Area -->
    <div
      class="settings-content"
      :style="padding"
    >
      <div
        v-for="item in menuItems"
        :key="item.key"
        :id="`item-${item.key}`"
        :data-key="item.key"
        class="settings-page-section"
      >
        <div
          class="settings-page-section-title"
          v-if="![SETTINGS_MENU_KEY.general, SETTINGS_MENU_KEY.backend].includes(item.key)"
        >
          {{ $t(item.label) }}
        </div>
        <component :is="item.component" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BackendSettings from '@/components/settings/BackendSettings.vue'
import ConnectionsSettings from '@/components/settings/ConnectionsSettings.vue'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import OverviewSettings from '@/components/settings/OverviewSettings.vue'
import ProxiesSettings from '@/components/settings/ProxiesSettings.vue'
import SettingsMenu from '@/components/settings/SettingsMenu.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import { isSettingVisible } from '@/composables/settings'
import { SETTINGS_MENU_KEY } from '@/constant'
import { isPWA } from '@/helper/utils'
import { settingsMenuOrder } from '@/store/settings'
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CubeTransparentIcon,
  GlobeAltIcon,
  HomeIcon,
  ServerIcon,
} from '@heroicons/vue/24/outline'
import { throttle } from 'lodash'
import type { Component } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type MenuItem = {
  key: SETTINGS_MENU_KEY
  label: string
  icon: Component
  component: Component
}

const { padding } = usePaddingForViews()
const route = useRoute()

const scrollContainerRef = ref<HTMLDivElement>()
const menuItems = computed<MenuItem[]>(() => {
  const itemsMap = new Map<SETTINGS_MENU_KEY, MenuItem>([
    [
      SETTINGS_MENU_KEY.general,
      {
        key: SETTINGS_MENU_KEY.general,
        label: 'zashboardSettings',
        icon: HomeIcon,
        component: GeneralSettings,
      },
    ],
    [
      SETTINGS_MENU_KEY.overview,
      {
        key: SETTINGS_MENU_KEY.overview,
        label: 'overviewSettings',
        icon: CubeTransparentIcon,
        component: OverviewSettings,
      },
    ],
    [
      SETTINGS_MENU_KEY.backend,
      {
        key: SETTINGS_MENU_KEY.backend,
        label: 'backendSettings',
        icon: ServerIcon,
        component: BackendSettings,
      },
    ],
    [
      SETTINGS_MENU_KEY.proxies,
      {
        key: SETTINGS_MENU_KEY.proxies,
        label: 'proxySettings',
        icon: GlobeAltIcon,
        component: ProxiesSettings,
      },
    ],
    [
      SETTINGS_MENU_KEY.connections,
      {
        key: SETTINGS_MENU_KEY.connections,
        label: 'connectionSettings',
        icon: ArrowsRightLeftIcon,
        component: ConnectionsSettings,
      },
    ],
  ])

  // 根据 settingsMenuOrder 排序，并过滤隐藏的项
  return settingsMenuOrder.value
    .map((key) => itemsMap.get(key))
    .filter((item): item is MenuItem => item !== undefined && isSettingVisible(item.key))
})
const activeMenuKey = ref<SETTINGS_MENU_KEY>(menuItems.value[0]?.key || SETTINGS_MENU_KEY.general)

// 当 menuItems 变化时，如果当前激活的项被隐藏，则切换到第一个可见项
watch(
  menuItems,
  (newItems) => {
    if (newItems.length > 0) {
      if (!newItems.find((item) => item.key === activeMenuKey.value)) {
        activeMenuKey.value = newItems[0].key
      }
    }
  },
  { immediate: true },
)
const getItemRef = (key: SETTINGS_MENU_KEY) => {
  return document.getElementById(`item-${key}`)
}

const isTriggerByClick = ref(false)
const timeoutId = ref<number>()

const handleMenuClick = (key: SETTINGS_MENU_KEY) => {
  activeMenuKey.value = key

  const index = menuItems.value.findIndex((item) => item.key === key)
  if (index !== -1) {
    isTriggerByClick.value = true
    clearTimeout(timeoutId.value)
    timeoutId.value = setTimeout(() => {
      isTriggerByClick.value = false
    }, 1000)
    const element = getItemRef(key)
    if (element && scrollContainerRef.value) {
      const containerRect = scrollContainerRef.value.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const scrollTop = scrollContainerRef.value.scrollTop
      const targetScrollTop = scrollTop + elementRect.top - containerRect.top - 54

      scrollContainerRef.value.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  }
}

const scrollTop = ref(0)
const updateActiveMenuByScroll = () => {
  if (!scrollContainerRef.value || isTriggerByClick.value) return

  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const newScrollTop = scrollContainerRef.value.scrollTop
  const scrollingDown = newScrollTop > scrollTop.value
  const containerTop = containerRect.top
  const containerBottom = containerRect.bottom
  const containerHeight = containerRect.height

  let bestKey: SETTINGS_MENU_KEY | null = null
  let bestScore = -Infinity

  menuItems.value.forEach((item) => {
    const element = getItemRef(item.key)
    if (!element) return

    const elementRect = element.getBoundingClientRect()
    const visibleTop = Math.max(elementRect.top, containerTop)
    const visibleBottom = Math.min(elementRect.bottom, containerBottom)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)

    if (visibleHeight <= 0) return

    // 元素自身的可见比例（对小元素更友好）
    const selfRatio = visibleHeight / elementRect.height
    // 元素占容器可见区域的比例
    const containerRatio = visibleHeight / containerHeight
    // 综合得分：优先考虑自身可见比例高的元素，其次考虑占容器比例
    // 当小元素完全可见时 selfRatio=1，得分会很高
    let score = selfRatio * 0.6 + containerRatio * 0.4

    // 滚动方向偏好：偏向即将进入视口的元素
    const elementCenter = (visibleTop + visibleBottom) / 2
    const referencePoint = containerTop + containerHeight * (scrollingDown ? 0.6 : 0.4)
    const normalizedDistance = Math.abs(elementCenter - referencePoint) / containerHeight
    score -= normalizedDistance * 0.2

    if (score > bestScore) {
      bestScore = score
      bestKey = item.key
    }
  })

  if (bestKey && bestKey !== activeMenuKey.value) {
    activeMenuKey.value = bestKey
  }

  scrollTop.value = newScrollTop
}

const handleScroll = throttle(updateActiveMenuByScroll, 100)

const refreshPages = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations()

  for (const registration of registrations) {
    registration.unregister()
  }
  window.location.reload()
}

onMounted(() => {
  requestAnimationFrame(async () => {
    const scrollTo = route.query.scrollTo as SETTINGS_MENU_KEY
    if (scrollTo) {
      handleMenuClick(scrollTo)
    }
  })
})
</script>
