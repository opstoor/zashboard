import { disconnectByIdAPI } from '@/assembly/connections'
import { fetchRules, ruleProviderList, toggleRuleDisabled } from '@/assembly/rules'
import { getConnectionRulePayload } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import { activeConnections } from '@/store/connections'
import { disconnectOnRuleDisable } from '@/store/settings'
import type { Rule } from '@/types'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

export const isRuleDisabled = (rule: Rule) => {
  if (rule.extra) {
    return rule.extra.disabled
  }

  return rule.disabled
}

export const getRuleSize = (rule: Rule) => {
  if (rule.type === 'RuleSet') {
    return ruleProviderList.value.find((provider) => provider.name === rule.payload)?.ruleCount
  }

  return rule.size
}

export const isUpdateableRuleSet = (rule: Rule) => {
  if (rule.type !== 'RuleSet') {
    return false
  }

  const provider = ruleProviderList.value.find((provider) => provider.name === rule.payload)

  if (!provider) {
    return false
  }

  return provider.vehicleType !== 'Inline'
}

export const toggleRuleDisabledWithSideEffects = async (rule: Rule) => {
  const willBeDisabled = !isRuleDisabled(rule)

  await toggleRuleDisabled(rule, willBeDisabled)

  if (willBeDisabled && disconnectOnRuleDisable.value) {
    const matchingConnections = activeConnections.value.filter((conn) => {
      const ruleTypeMatches = conn.rule === rule.type
      const rulePayloadMatches = getConnectionRulePayload(conn) === (rule.payload || '')

      return ruleTypeMatches && rulePayloadMatches
    })

    matchingConnections.forEach((conn) => disconnectByIdAPI(conn.id).catch(() => {}))
  }

  await fetchRules()
}

export const EMPTY_CELL = '—'

export const formatRuleHitCount = (count: number | undefined) =>
  count ? count.toLocaleString() : EMPTY_CELL

export const useRuleHitTooltip = () => {
  const { t } = useI18n()
  const { showTip } = useTooltip()

  const buildLine = (text: string) => {
    const line = document.createElement('div')

    line.textContent = text

    return line
  }

  const formatHitTime = (count: number, at: string) => {
    if (!count || !at) return t('unknown')

    const time = dayjs(at)

    return time.isValid() && time.year() > 1 ? time.format('YYYY-MM-DD HH:mm:ss') : t('unknown')
  }

  const buildSection = (countText: string, count: number, at: string, lastTextKey: string) => {
    const section = document.createElement('div')

    section.className = 'flex flex-col gap-1'
    section.append(buildLine(countText))
    section.append(buildLine(t(lastTextKey, { time: formatHitTime(count, at) })))

    return section
  }

  const showRuleHitTip = (event: Event, rule: Rule) => {
    const extra = rule.extra

    if (!extra) return

    const content = document.createElement('div')

    content.className = 'flex flex-col gap-2 text-sm'
    content.append(
      buildSection(
        t('ruleHitCount', { count: extra.hitCount }),
        extra.hitCount,
        extra.hitAt,
        'ruleLastHit',
      ),
      buildSection(
        t('ruleMissCount', { count: extra.missCount }),
        extra.missCount,
        extra.missAt,
        'ruleLastMiss',
      ),
    )

    showTip(event, content, {
      delay: [500, 0],
      trigger: 'mouseenter',
    })
  }

  return { showRuleHitTip }
}
