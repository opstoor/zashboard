<template>
  <div class="flex items-center gap-1 overflow-hidden">
    <img
      :src="isSingBox ? SingBoxLogo : MetacubexLogo"
      class="h-4 w-4 rounded-xs"
    />
    <span
      class="text-base-content/60 truncate"
      @mouseenter="checkTruncation"
    >
      {{ version }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { isSingBox, version } from '@/api'
import { checkTruncation } from '@/helper/tooltip'

const MetacubexLogo = `${import.meta.env.BASE_URL}images/metacubex.jpg`
const SingBoxLogo = `${import.meta.env.BASE_URL}images/sing-box.svg`
</script>
