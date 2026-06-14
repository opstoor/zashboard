import { onBeforeUnmount, onMounted, ref } from 'vue'

// Height (px) of the on-screen keyboard, derived from the visual viewport.
// Stays 0 on desktop (no soft keyboard), so callers can gate mobile-only UI on
// `inset > 0` without an explicit platform check.
export const useKeyboardInset = () => {
  const inset = ref(0)

  const update = () => {
    const viewport = window.visualViewport
    if (!viewport) return
    const height = window.innerHeight - viewport.height
    inset.value = height > 1 ? Math.round(height) : 0
  }

  onMounted(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    update()
    viewport.addEventListener('resize', update)
  })

  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update)
  })

  return inset
}
