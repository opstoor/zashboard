import { fetchHonkStatsAPI } from '@/api/clash'
import { can } from '@/assembly/backend'
import type { HonkStats } from '@/types'
import { shallowRef } from 'vue'

export const honkStats = shallowRef<HonkStats>()

const POLL_INTERVAL = 5000

let timer: ReturnType<typeof setInterval> | undefined

export const fetchHonkStats = async () => {
  if (!can('runtimeStats')) {
    honkStats.value = undefined
    return
  }

  try {
    const { data } = await fetchHonkStatsAPI()

    honkStats.value = data
  } catch {
    honkStats.value = undefined
  }
}

export const startHonkStats = () => {
  if (timer) return

  fetchHonkStats()
  timer = setInterval(fetchHonkStats, POLL_INTERVAL)
}

export const stopHonkStats = () => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
  honkStats.value = undefined
}
