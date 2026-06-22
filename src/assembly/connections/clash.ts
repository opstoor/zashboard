// Clash WS 后端的连接流与断连动作。
import { createClashWebSocket, disconnectAllClashAPI, disconnectClashByIdAPI } from '@/api/clash'

export const disconnectByIdAPI = disconnectClashByIdAPI

export const disconnectAllAPI = disconnectAllClashAPI

export const fetchConnectionsAPI = <T>() => createClashWebSocket<T>('connections')
