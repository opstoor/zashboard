<template>
  <div class="scroller-item">
    <div class="flex items-center gap-3 px-4 py-2.5 text-sm">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span class="text-base-content/40 shrink-0 text-xs tabular-nums">{{ index }}</span>
        <span class="text-main min-w-0 truncate font-medium">{{ ruleProvider.name }}</span>
        <span class="text-base-content/50 shrink-0 text-xs"
          >{{ ruleProvider.ruleCount }} {{ $t('rules') }}</span
        >
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          v-if="ruleProvider.behavior"
          class="badge badge-sm font-mono text-xs"
        >
          {{ ruleProvider.behavior }}
        </span>
        <span
          v-if="ruleProvider.vehicleType"
          class="badge badge-sm font-mono text-xs"
        >
          {{ ruleProvider.vehicleType }}
        </span>
        <span class="text-base-content/40 text-xs">{{ fromNow(ruleProvider.updatedAt) }}</span>
        <button
          v-if="ruleProvider.vehicleType !== 'Inline'"
          :class="twMerge('btn btn-circle btn-ghost btn-xs', isUpdating ? 'animate-spin' : '')"
          @click="updateRuleProviderClickHandler"
        >
          <ArrowPathIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { updateRuleProviderAPI } from '@/api'
import { useBounceOnVisible } from '@/composables/bouncein'
import { fromNow } from '@/helper/utils'
import { fetchRules } from '@/store/rules'
import type { RuleProvider } from '@/types'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { ref } from 'vue'
const isUpdating = ref(false)
const props = defineProps<{
  ruleProvider: RuleProvider
  index: number
}>()

const updateRuleProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  await updateRuleProviderAPI(props.ruleProvider.name)
  fetchRules()
  isUpdating.value = false
}

useBounceOnVisible()
</script>
