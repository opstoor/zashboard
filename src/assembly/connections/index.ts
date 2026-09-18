import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '@/constant'
import type { Connection } from '@/types'
import type { ConnectionDisplayOptions, ConnectionsSnapshot } from './accessor'
import * as clash from './clash'

export type { ConnectionsSnapshot }

export const disconnectByIdAPI = (id: string) => clash.disconnectByIdAPI(id)

export const disconnectAllAPI = () => clash.disconnectAllAPI()

export const fetchConnectionsAPI = () => clash.fetchConnectionsAPI()

export const connectionAccessor = () => clash.connectionAccessor

export const getConnectionDisplayValue = (
  connection: Connection,
  key: CONNECTIONS_TABLE_ACCESSOR_KEY,
  options: ConnectionDisplayOptions,
) => clash.getConnectionDisplayValue(connection, key, options)

export const getConnectionVisibleSearchValues = (
  connection: Connection,
  keys: CONNECTIONS_TABLE_ACCESSOR_KEY[],
  options: ConnectionDisplayOptions,
) => clash.getConnectionVisibleSearchValues(connection, keys, options)

export { blockConnectionByIdAPI } from '@/api/clash'
