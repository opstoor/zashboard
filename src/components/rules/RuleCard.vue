<template>
  <div :class="{ 'opacity-50': isDisabled, 'scroller-item': 1 }">
    <div
      class="hover:bg-base-200/40 flex flex-col gap-2 overflow-hidden p-3 pt-2 text-sm transition-colors"
      :class="{
        'cursor-pointer': isSelectable,
      }"
      @click="clickHandler"
    >
      <div class="min-h-6 leading-6">
        <span class="text-base-content/40 text-xs">
          {{ index }}
        </span>
        <span class="text-base-content/80 ml-4 text-xs"
          >{{ rule.type }} <template v-if="rule.payload"> : </template></span
        >
        <span
          class="ml-2"
          v-if="rule.payload"
        >
          {{ rule.payload }}
        </span>
        <span
          v-if="typeof size === 'number' && size !== -1"
          class="text-base-content/80 ml-1 text-xs"
        >
          ({{ size }})
          <QuestionMarkCircleIcon
            v-if="size === 0"
            class="-mt-1 ml-1 inline-block h-4 w-4"
            @mouseenter="showMMDBSizeTip"
          />
        </span>
        <button
          v-if="isUpdateableRuleSet"
          :class="
            twMerge(
              'btn btn-circle btn-ghost btn-xs -mt-[2px] ml-1',
              isUpdating ? 'animate-spin' : '',
            )
          "
          @click.stop="updateRuleProviderClickHandler"
        >
          <ArrowPathIcon class="h-4 w-4" />
        </button>
        <InformationCircleIcon
          v-if="rule.extra"
          class="-mt-[2px] ml-1 inline-block h-4 w-4"
          @mouseenter="showRuleHitInfoTip"
          @click.stop
        />
      </div>
      <div class="flex min-h-6 flex-wrap items-center gap-1 md:gap-2">
        <input
          v-if="rule.uuid || rule.extra"
          type="checkbox"
          class="toggle toggle-sm"
          :checked="!isDisabled"
          @change="toggleRuleDisabledHandler"
          @click.stop
        />
        <div
          class="proxy-chain-path"
          v-if="isCollapsed"
        >
          <span class="proxy-chain-node">
            <ProxyName :name="rule.proxy" />
          </span>
          <template v-if="proxyNode?.now && displayNowNodeInRule">
            <ChevronRightIcon class="proxy-chain-separator" />
            <span class="proxy-chain-node pointer-events-none">
              <ProxyName :name="getNowProxyNodeName(rule.proxy)" />
            </span>
          </template>
        </div>
        <template v-else>
          <div class="proxy-chain-path">
            <template
              v-for="(chain, index) in proxyChains"
              :key="chain"
            >
              <ChevronRightIcon
                class="proxy-chain-separator"
                v-if="index > 0"
              />
              <span
                class="proxy-chain-node"
                :class="{
                  'proxy-chain-node-active': selected === chain,
                }"
                @click.stop="selected = chain"
              >
                <ProxyName :name="chain" />
              </span>
            </template>
            <template
              v-if="
                getNowProxyNodeName(rule.proxy) &&
                getNowProxyNodeName(rule.proxy) !== proxyChains[proxyChains.length - 1]
              "
            >
              <ChevronRightIcon class="proxy-chain-separator" />
              <span
                class="proxy-chain-node proxy-chain-node-terminal"
                @click.stop
              >
                <ProxyName :name="getNowProxyNodeName(rule.proxy)" />
              </span>
            </template>
          </div>
        </template>
        <span
          v-if="latency !== NOT_CONNECTED && displayLatencyInRule"
          :class="latencyColor"
          class="ml-1 text-xs"
        >
          {{ latency }}
        </span>
      </div>
    </div>

    <template v-if="isSelectable && !isCollapsed">
      <div class="border-base-content/3 border-b"></div>
      <ProxyGroup
        :name="selected"
        :force-open="true"
        class="transparent-collapse bg-base-200/40! rounded-none!"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  disconnectByIdAPI,
  toggleRuleDisabledAPI,
  toggleRuleDisabledSingBoxAPI,
  updateRuleProviderAPI,
} from '@/api'
import { useBounceOnVisible } from '@/composables/bouncein'
import { NOT_CONNECTED } from '@/constant'
import { getColorForLatency } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import { activeConnections } from '@/store/connections'
import {
  getLatencyByName,
  getNowProxyNodeName,
  getProxyGroupChains,
  proxyGroupList,
  proxyMap,
} from '@/store/proxies'
import { fetchRules, ruleProviderList } from '@/store/rules'
import {
  disconnectOnRuleDisable,
  displayLatencyInRule,
  displayNowNodeInRule,
} from '@/store/settings'
import type { Rule } from '@/types'
import {
  ArrowPathIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import type { Ref } from 'vue'
import { computed, createApp, defineComponent, h, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProxyGroup from '../proxies/ProxyGroup.vue'
import ProxyName from '../proxies/ProxyName.vue'

const props = defineProps<{
  rule: Rule
  index: number
}>()

const expandedRule = inject<Ref<string | null>>('expandedRule', ref(null))
const ruleKey = computed(() => `${props.index}-${props.rule.payload}`)
const isCollapsed = computed(() => expandedRule.value !== ruleKey.value)
const isSelectable = computed(() => proxyGroupList.value.includes(props.rule.proxy))
const selected = ref('')
const proxyChains = computed(() => getProxyGroupChains(props.rule.proxy))

const { t } = useI18n()
const { showTip } = useTooltip()
const proxyNode = computed(() => proxyMap.value[props.rule.proxy])
const latency = computed(() => getLatencyByName(props.rule.proxy, props.rule.proxy))
const latencyColor = computed(() => getColorForLatency(Number(latency.value)))

const size = computed(() => {
  if (props.rule.type === 'RuleSet') {
    return ruleProviderList.value.find((provider) => provider.name === props.rule.payload)
      ?.ruleCount
  }

  return props.rule.size
})

const isUpdating = ref(false)
const isTogglingDisabled = ref(false)
const isDisabled = computed(() => {
  const rule = props.rule

  if (rule.extra) {
    return rule.extra.disabled
  }

  return rule.disabled
})

const isUpdateableRuleSet = computed(() => {
  if (props.rule.type !== 'RuleSet') {
    return false
  }

  const provider = ruleProviderList.value.find((provider) => provider.name === props.rule.payload)

  if (!provider) {
    return false
  }
  return provider.vehicleType !== 'Inline'
})

const updateRuleProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  await updateRuleProviderAPI(props.rule.payload)
  await fetchRules()
  isUpdating.value = false
}

const toggleRuleDisabledHandler = async () => {
  if (isTogglingDisabled.value) return

  try {
    isTogglingDisabled.value = true
    const willBeDisabled = !isDisabled.value

    if (props.rule.uuid) {
      await toggleRuleDisabledSingBoxAPI(props.rule.uuid)
    } else {
      await toggleRuleDisabledAPI({ [props.rule.index]: willBeDisabled })
    }

    if (willBeDisabled && disconnectOnRuleDisable.value) {
      const matchingConnections = activeConnections.value.filter((conn) => {
        const ruleTypeMatches = conn.rule === props.rule.type
        const rulePayloadMatches = (conn.rulePayload || '') === (props.rule.payload || '')
        return ruleTypeMatches && rulePayloadMatches
      })

      if (matchingConnections.length > 0) {
        matchingConnections.forEach((conn) => disconnectByIdAPI(conn.id))
      }
    }

    await fetchRules()
  } finally {
    isTogglingDisabled.value = false
  }
}

const showMMDBSizeTip = (e: Event) => {
  showTip(e, t('mmdbSizeTip'))
}

const ruleHitCount = computed(() => t('ruleHitCount', { count: props.rule.extra?.hitCount }))
const ruleLastHit = computed(() =>
  t('ruleLastHit', { time: dayjs(props.rule.extra?.hitAt).format('YYYY-MM-DD HH:mm:ss') }),
)
const ruleMissCount = computed(() => t('ruleMissCount', { count: props.rule.extra?.missCount }))
const ruleLastMiss = computed(() =>
  t('ruleLastMiss', { time: dayjs(props.rule.extra?.missAt).format('YYYY-MM-DD HH:mm:ss') }),
)

const showRuleHitInfoTip = (e: Event) => {
  if (!props.rule.extra) return

  const PopContent = defineComponent({
    setup() {
      return () =>
        h('div', { class: 'flex flex-col gap-2 text-sm' }, [
          h('div', { class: 'flex flex-col gap-1' }, [
            h('div', ruleHitCount.value),
            h('div', ruleLastHit.value),
          ]),
          h('div', { class: 'flex flex-col gap-1' }, [
            h('div', ruleMissCount.value),
            h('div', ruleLastMiss.value),
          ]),
        ])
    },
  })
  const mountEl = document.createElement('div')
  const app = createApp(PopContent)

  app.mount(mountEl)

  showTip(e, mountEl, {
    delay: [500, 0],
    trigger: 'mouseenter',
  })
}

const clickHandler = () => {
  if (isSelectable.value && !props.rule.disabled) {
    expandedRule.value = isCollapsed.value ? ruleKey.value : null
    selected.value = props.rule.proxy
  }
}

useBounceOnVisible()
</script>

<style scoped>
.proxy-chain-path {
  flex-shrink: 1;
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background-color: color-mix(in srgb, var(--color-base-content) 4%, transparent);
  padding: 2px;
  gap: 0;
  overflow-x: auto;
}

.proxy-chain-node {
  flex-shrink: 0;
  padding: 1px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1.25rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  white-space: nowrap;
}

.proxy-chain-node:hover {
  background-color: color-mix(in srgb, var(--color-base-content) 8%, transparent);
}

.proxy-chain-node-active {
  background-color: var(--color-neutral);
  color: var(--color-neutral-content);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.proxy-chain-node-active:hover {
  background-color: var(--color-neutral);
}

.proxy-chain-node-terminal {
  cursor: not-allowed;
  opacity: 0.6;
}

.proxy-chain-separator {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.35;
}
</style>
