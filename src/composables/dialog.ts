import { onUnmounted, ref, watch, type Ref } from 'vue'

export const openDialogCount = ref(0)

export const dimmedOverlayCount = ref(0)

const useCount = (count: Ref<number>, active: Ref<boolean | undefined>) => {
  let held = false

  const acquire = () => {
    if (held) return
    held = true
    count.value++
  }

  const release = () => {
    if (!held) return
    held = false
    count.value--
  }

  watch(active, (val) => (val ? acquire() : release()), { immediate: true })
  onUnmounted(release)
}

export const useDialogOpenState = (isOpen: Ref<boolean | undefined>) => {
  useCount(openDialogCount, isOpen)
  useCount(dimmedOverlayCount, isOpen)
}

export const useOverlayDimState = (isDimmed: Ref<boolean | undefined>) => {
  useCount(dimmedOverlayCount, isDimmed)
}
