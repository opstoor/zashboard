<template>
  <div class="mx-1 flex flex-col items-center gap-1 py-2">
    <div class="flex w-full flex-col items-center gap-1 px-1">
      <template
        v-for="(item, index) in statItems"
        :key="item.type"
      >
        <div
          v-if="index > 0"
          class="bg-base-content/8 my-1 h-px w-6"
        />
        <div class="flex flex-col items-center gap-1 py-1">
          <component
            :is="item.icon"
            class="h-3.5 w-3.5"
            :class="item.iconColor ?? 'text-base-content/60'"
          />
          <span class="text-base-content/90 text-[11px] leading-tight font-medium tabular-nums">
            {{ statisticsMap[item.type] }}
          </span>
          <span
            v-if="item.secondary"
            class="text-base-content/40 text-[10px] leading-tight tabular-nums"
          >
            {{ statisticsMap[item.secondary] }}
          </span>
        </div>
      </template>
    </div>

    <div class="mt-1 flex flex-col items-center">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATISTICS_TYPE, statisticsMap } from '@/composables/statistics'
import {
  ArrowDownCircleIcon,
  ArrowsRightLeftIcon,
  ArrowUpCircleIcon,
  CpuChipIcon,
} from '@heroicons/vue/24/outline'

const statItems = [
  { type: STATISTICS_TYPE.CONNECTIONS, icon: ArrowsRightLeftIcon },
  {
    type: STATISTICS_TYPE.DL_SPEED,
    icon: ArrowDownCircleIcon,
    iconColor: 'text-primary/70',
    secondary: STATISTICS_TYPE.DOWNLOAD,
  },
  {
    type: STATISTICS_TYPE.UL_SPEED,
    icon: ArrowUpCircleIcon,
    iconColor: 'text-info/70',
    secondary: STATISTICS_TYPE.UPLOAD,
  },
  { type: STATISTICS_TYPE.MEMORY_USAGE, icon: CpuChipIcon },
]
</script>
