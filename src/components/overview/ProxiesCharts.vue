<template>
  <div class="relative h-96 w-full overflow-hidden">
    <div
      ref="chart"
      class="h-full w-full"
    />
    <span
      class="border-b-primary/30 border-t-primary/60 border-l-info/30 border-r-info/60 text-base-content/10 bg-base-100/70 hidden"
      ref="colorRef"
    />
  </div>
</template>

<script setup lang="ts">
import { isSingBox } from '@/api'
import { proxyGroupList, proxyMap } from '@/store/proxies'
import { font, theme } from '@/store/settings'
import { useElementSize } from '@vueuse/core'
import { TreeChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { computed, onMounted, ref, watch } from 'vue'

echarts.use([TreeChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const colorRef = ref()
const chart = ref()
const colorSet = {
  primary30: '',
  primary60: '',
  info30: '',
  info60: '',
  baseContent10: '',
  baseContent: '',
  base70: '',
}

let fontFamily = ''

const updateColorSet = () => {
  const colorStyle = getComputedStyle(colorRef.value)

  colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim()
  colorSet.base70 = colorStyle.backgroundColor
  colorSet.baseContent10 = colorStyle.color
  colorSet.primary30 = colorStyle.borderTopColor
  colorSet.primary60 = colorStyle.borderBottomColor
  colorSet.info30 = colorStyle.borderLeftColor
  colorSet.info60 = colorStyle.borderRightColor
}
const updateFontFamily = () => {
  const baseColorStyle = getComputedStyle(colorRef.value)

  fontFamily = baseColorStyle.fontFamily
}

type Tree = {
  name: string
  children?: Tree[]
  collapsed?: boolean
}

const forEachAllProxies = (data: Tree) => {
  const children = proxyMap.value[data.name]

  if (children) {
    data.children = []
    children.all?.forEach((proxy) => {
      const childData = {
        name: proxy,
        value: proxy,
      }
      data.children?.push(childData)
      forEachAllProxies(childData)
    })
  }
}

const treeData = computed(() => {
  const rootName = isSingBox.value ? 'SingBox' : 'Mihomo'
  const data = {
    name: rootName,
    children: [] as Tree[],
    collapsed: false,
  }

  proxyGroupList.value.forEach((groupName: string) => {
    const childrenData: Tree = {
      name: groupName,
    }

    forEachAllProxies(childrenData)
    data.children.push(childrenData)
  })

  return [data]
})

const options = computed(() => {
  return {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
    },
    series: [
      {
        roam: true,
        type: 'tree',
        data: treeData.value,
        top: '5%',
        left: '3%',
        bottom: '5%',
        right: '3%',
        symbolSize: 7,
        orient: 'TB',
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 9,
          color: colorSet.baseContent,
          fontFamily,
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },
        emphasis: {
          focus: 'descendant',
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
      },
    ],
  }
})

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  const myChart = echarts.init(chart.value)

  myChart.setOption(options.value)
  console.log(options.value)

  watch(options, () => {
    console.log(options.value)
    myChart?.setOption(options.value)
  })

  const { width } = useElementSize(chart)
  const resize = debounce(() => {
    myChart.resize()
  }, 100)

  watch(width, resize)
})
</script>
