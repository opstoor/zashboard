import { toggleRuleDisabledAPI, toggleRuleDisabledRefindAPI } from '@/api/clash'
import { RULE_TAB_TYPE } from '@/constant'
import { toSearchRegex } from '@/helper/search'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref } from 'vue'
import * as clash from './clash'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])

export const renderRules = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return rules.value
  }

  return rules.value.filter((rule) => {
    return searchRegex.testAny([rule.type, rule.payload, rule.proxy])
  })
})

export const renderRulesProvider = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return searchRegex.testAny([ruleProvider.name, ruleProvider.behavior, ruleProvider.vehicleType])
  })
})

export const fetchRules = () => clash.fetchRules()

export const toggleRuleDisabled = (rule: Rule, disabled: boolean) =>
  rule.uuid
    ? toggleRuleDisabledRefindAPI(rule.uuid)
    : toggleRuleDisabledAPI({ [rule.index]: disabled })

export { updateRuleProviderAPI } from '@/api/clash'
