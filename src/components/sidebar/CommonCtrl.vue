<template>
  <div class="flex flex-col gap-2 p-2 text-sm">
    <StatisticsStats type="ctrl" />
    <BackendSwitch :is-edit="false" />
    <div class="flex gap-2">
      <button
        class="btn btn-circle btn-sm"
        @click="isSidebarCollapsed = true"
      >
        <ArrowLeftCircleIcon class="h-5 w-5" />
      </button>
      <BackendVersion />
    </div>
  </div>
</template>

<script setup lang="ts">
import { isSidebarCollapsed } from '@/store/settings'
import { ArrowLeftCircleIcon } from '@heroicons/vue/24/outline'
import BackendVersion from '../common/BackendVersion.vue'
import StatisticsStats from '../overview/StatisticsStats.vue'
import BackendSwitch from '../settings/BackendSwitch.vue'
</script>
