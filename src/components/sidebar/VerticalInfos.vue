<template>
  <div class="card text-base-content/80 mx-1 flex flex-col gap-4 py-2 text-xs">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col items-center justify-center gap-1">
        <ArrowsRightLeftIcon class="text-base-content h-4 w-4" />
        {{ statisticsMap[STATISTICS_TYPE.CONNECTIONS] }}
      </div>
      <div class="flex flex-col items-center justify-center gap-1">
        <ArrowDownCircleIcon class="text-base-content h-4 w-4" />
        {{ statisticsMap[STATISTICS_TYPE.DOWNLOAD] }}
        <span>{{ statisticsMap[STATISTICS_TYPE.DL_SPEED] }}</span>
      </div>
      <div class="flex flex-col items-center justify-center gap-1">
        <ArrowUpCircleIcon class="text-base-content h-4 w-4" />
        {{ statisticsMap[STATISTICS_TYPE.UPLOAD] }}
        <span>{{ statisticsMap[STATISTICS_TYPE.UL_SPEED] }}</span>
      </div>
      <div class="flex flex-col items-center justify-center gap-1">
        <CpuChipIcon class="text-base-content h-4 w-4" />
        {{ statisticsMap[STATISTICS_TYPE.MEMORY_USAGE] }}
      </div>
    </div>

    <div class="flex flex-col items-center justify-center">
      <button
        class="btn btn-circle btn-sm"
        @click="isSidebarCollapsed = false"
      >
        <ArrowRightCircleIcon class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STATISTICS_TYPE, statisticsMap } from '@/composables/statistics'
import { isSidebarCollapsed } from '@/store/settings'
import {
  ArrowDownCircleIcon,
  ArrowRightCircleIcon,
  ArrowsRightLeftIcon,
  ArrowUpCircleIcon,
  CpuChipIcon,
} from '@heroicons/vue/24/outline'
</script>
