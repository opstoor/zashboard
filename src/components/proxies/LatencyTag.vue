<template>
  <div
    :class="
      twMerge(
        'latency-tag bg-base-100 h-5 w-10 rounded-xl text-xs select-none md:hover:shadow-sm',
        color,
      )
    "
    @mouseenter="handlerHistoryTip"
  >
    <span
      class="latency-state loading loading-dots loading-xs text-base-content/80"
      :class="stateClass('loading')"
    ></span>
    <BoltIcon
      class="latency-state text-base-content h-3 w-3"
      :class="stateClass('empty')"
    />
    <div
      ref="latencyRef"
      class="latency-state tabular-nums"
      :class="stateClass('value')"
    >
      {{ latency }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { NOT_CONNECTED } from '@/constant'
import { getColorForLatency } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import { getHistoryByName, getLatencyByName } from '@/assembly/proxies'
import { BoltIcon } from '@heroicons/vue/24/outline'
import { CountUp } from 'countup.js'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const { showTip } = useTooltip()
const handlerHistoryTip = (e: Event) => {
  const history = getHistoryByName(props.name ?? '', props.groupName)

  if (!history.length) return

  const historyList = document.createElement('div')

  historyList.classList.add('flex', 'flex-col', 'gap-1')
  for (const item of history) {
    const itemDiv = document.createElement('div')
    const time = document.createElement('div')
    const latency = document.createElement('div')

    time.textContent = dayjs(item.time).format('YYYY-MM-DD HH:mm:ss')
    latency.textContent = item.delay + 'ms'
    latency.className = getColorForLatency(item.delay)

    itemDiv.classList.add('flex', 'items-center', 'gap-2')
    itemDiv.append(time, latency)
    historyList.append(itemDiv)
  }

  showTip(e, historyList, {
    delay: [1000, 0],
    trigger: 'mouseenter',
    touch: false,
  })
}

const props = defineProps<{
  name?: string
  loading?: boolean
  groupName?: string
}>()
const latencyRef = ref()
const latency = computed(() => getLatencyByName(props.name ?? '', props.groupName))
let countUp: CountUp | null = null

onMounted(() => {
  watch(latency, (value, OldValue) => {
    if (!countUp) {
      nextTick(() => {
        countUp = new CountUp(latencyRef.value, latency.value, {
          duration: 1,
          separator: '',
          enableScrollSpy: false,
          startVal: OldValue,
        })
        countUp?.update(value)
      })
    } else {
      countUp?.update(value)
    }
  })
})

onUnmounted(() => {
  countUp = null
})

const color = computed(() => {
  return getColorForLatency(latency.value)
})

// 三态(测速中 / 无数据 / 有延迟)叠在同一个网格单元里交叉淡入淡出,
// 数字节点始终挂载,CountUp 才能持有稳定的 DOM 引用。
type LatencyState = 'loading' | 'empty' | 'value'

const state = computed<LatencyState>(() => {
  if (props.loading) return 'loading'
  if (latency.value === NOT_CONNECTED || !latency.value) return 'empty'
  return 'value'
})

const stateClass = (target: LatencyState) =>
  state.value === target ? 'latency-state-in' : 'latency-state-out'
</script>

<style scoped>
.latency-tag {
  display: grid;
  place-items: center;
  transition:
    color 0.35s ease-out,
    background-color 0.35s ease-out;
}

.latency-state {
  grid-area: 1 / 1;
  transition:
    opacity 0.2s ease-out,
    scale 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.latency-state-in {
  opacity: 1;
  scale: 1;
}

.latency-state-out {
  opacity: 0;
  scale: 0.6;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .latency-tag,
  .latency-state {
    transition: none;
  }
}
</style>
