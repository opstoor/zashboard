// 组装层 · connections 门面。连接流与断连/封锁动作,按后端类型路由,
// 统一返回 { data, close } 流。
import { isSingboxBackend } from '@/assembly/backend'
import * as clash from './clash'
import * as singbox from './singbox'

const backend = () => (isSingboxBackend.value ? singbox : clash)

export const disconnectByIdAPI = (id: string) => backend().disconnectByIdAPI(id)

export const disconnectAllAPI = () => backend().disconnectAllAPI()

export const fetchConnectionsAPI = <T>() => backend().fetchConnectionsAPI<T>()

// 连接封锁动作(Clash 专属),经 connections 域门面暴露给 view。
export { blockConnectionByIdAPI } from '@/api/clash'
