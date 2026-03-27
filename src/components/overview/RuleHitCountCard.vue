<template>
  <div
    class="card w-full"
    v-if="hasRulesWithExtra"
  >
    <div class="card-body gap-4">
      <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
        {{ $t('ruleHitCountCard') }}
      </div>
      <div class="bg-base-200/30 flex flex-col gap-2 rounded-xl p-3">
        <RuleHitCountChart type="hit" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import RuleHitCountChart from '@/components/overview/RuleHitCountChart.vue'
import { rules } from '@/store/rules'
import { computed } from 'vue'

// 检查是否有规则含有 extra 字段
const hasRulesWithExtra = computed(() => {
  return rules.value.some((rule) => rule.extra)
})
</script>
