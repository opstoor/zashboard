<template>
  <div class="card w-full">
    <div class="card-body gap-4">
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ConnectionStatus />
        <IPCheck />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConnectionStatus from '@/components/overview/ConnectionStatus.vue'
import IPCheck from '@/components/overview/IPCheck.vue'
</script>
