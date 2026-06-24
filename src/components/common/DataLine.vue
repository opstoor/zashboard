<template>
  <div class="flex items-center justify-between gap-3 px-3 py-2">
    <span class="flex-shrink-0 opacity-60">{{ label }}</span>
    <span
      class="text-right break-all"
      :class="mono && 'font-mono text-xs'"
      >{{ value }}</span
    >
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string
  mono?: boolean
}>()
</script>
