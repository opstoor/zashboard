<template>
  <div
    class="sidebar-chart-group base-container flex-2"
    :data-rows="numberOfChartsInSidebar"
  >
    <div class="sidebar-chart-scroller scrollbar-hidden">
      <SpeedCharts class="sidebar-chart-row" />
      <MemoryCharts class="sidebar-chart-row" />
      <ConnectionsCharts class="sidebar-chart-row" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ConnectionsCharts from '@/components/overview/ConnectionsCharts.vue'
import MemoryCharts from '@/components/overview/MemoryCharts.vue'
import SpeedCharts from '@/components/overview/SpeedCharts.vue'
import { numberOfChartsInSidebar } from '@/store/settings'
</script>
