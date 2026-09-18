import { isSettingVisible } from '@/composables/settings'
import { DEFAULT_SETTINGS_MENU_ORDER, SETTINGS_CATEGORIES } from '@/config/settingsItems'
import { SETTINGS_MENU_KEY } from '@/constant'
import { isMiddleScreen } from '@/helper/utils'
import { settingsMenuOrder } from '@/store/settings'
import { computed, ref } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'

type SettingsQuery = Record<string, LocationQueryValue | LocationQueryValue[] | undefined>

const enteredFromMobileIndex = ref(false)

export const visibleSectionKeys = computed(() => {
  const order = [
    ...settingsMenuOrder.value,
    ...DEFAULT_SETTINGS_MENU_ORDER.filter((key) => !settingsMenuOrder.value.includes(key)),
  ]

  return order.filter(
    (key) => SETTINGS_CATEGORIES.some((category) => category.key === key) && isSettingVisible(key),
  )
})

export const useSettingsSection = () => {
  const route = useRoute()
  const router = useRouter()

  const sectionKey = computed(() => {
    const value = route.query.section
    if (typeof value !== 'string') return undefined
    return visibleSectionKeys.value.find((key) => key === value)
  })

  const isSettingsSubPage = computed(() => isMiddleScreen.value && Boolean(sectionKey.value))

  const enterSection = async (key: SETTINGS_MENU_KEY, settingKey?: string) => {
    const fromMobileIndex = isMiddleScreen.value && !sectionKey.value
    const query: SettingsQuery = { ...route.query, section: key }

    delete query.scrollTo
    if (settingKey) query.setting = settingKey
    else delete query.setting

    if (!isMiddleScreen.value) {
      enteredFromMobileIndex.value = false
      await router.replace({ query })
      return
    }

    await router.push({ query })
    if (fromMobileIndex) enteredFromMobileIndex.value = true
  }

  const exitSection = async () => {
    if (enteredFromMobileIndex.value) {
      enteredFromMobileIndex.value = false
      router.back()
      return
    }

    const query: SettingsQuery = { ...route.query }

    delete query.section
    delete query.setting
    delete query.scrollTo
    await router.replace({ query })
  }

  return {
    sectionKey,
    isSettingsSubPage,
    enterSection,
    exitSection,
    enteredFromMobileIndex,
  }
}
