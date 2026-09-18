import { getConnectionGeoIPInfoSync } from '@/api/connectionGeoip'
import { CONNECTIONS_TABLE_ACCESSOR_KEY, PROXY_CHAIN_DIRECTION } from '@/constant'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { fromNow, prettyBytesHelper } from '@/helper/utils'
import type { Connection } from '@/types'
import * as ipaddr from 'ipaddr.js'

export type ConnectionDisplayOptions = {
  mode: 'card' | 'table'
  proxyChainDirection: PROXY_CHAIN_DIRECTION | string
  showFullProxyChain: boolean
}

export interface ConnectionsSnapshot {
  active: Connection[]
  closed: Connection[]
  downloadTotal?: number
  uploadTotal?: number
}

export interface ConnectionAccessor {
  chains(connection: Connection): string[]
  download(connection: Connection): number
  upload(connection: Connection): number
  start(connection: Connection): string | number
  rule(connection: Connection): string
  rulePayload(connection: Connection): string
  sourceIP(connection: Connection): string
  sourcePort(connection: Connection): string
  network(connection: Connection): string
  networkType(connection: Connection): string
  hostname(connection: Connection): string
  host(connection: Connection): string
  process(connection: Connection): string
  destination(connection: Connection): string
  inboundUser(connection: Connection): string
  sniffHost(connection: Connection): string
  remoteAddress(connection: Connection): string
  isDirect(connection: Connection): boolean
  smartBlock(connection: Connection): string | undefined
}

const getDestinationType = (destination: string) => {
  if (ipaddr.IPv4.isIPv4(destination)) {
    return 'IPv4'
  } else if (ipaddr.IPv6.isIPv6(destination)) {
    return 'IPv6'
  } else {
    return 'FQDN'
  }
}

const getVisibleChains = (
  accessor: ConnectionAccessor,
  connection: Connection,
  options: ConnectionDisplayOptions,
) => {
  let chains = accessor.chains(connection)

  if ((options.mode === 'card' || !options.showFullProxyChain) && chains.length > 2) {
    chains = [chains[0], chains[chains.length - 1]]
  }

  return options.proxyChainDirection === PROXY_CHAIN_DIRECTION.REVERSE
    ? chains
    : [...chains].reverse()
}

export const createGetConnectionDisplayValue =
  (accessor: ConnectionAccessor) =>
  (
    connection: Connection,
    key: CONNECTIONS_TABLE_ACCESSOR_KEY,
    options: ConnectionDisplayOptions,
  ) => {
    switch (key) {
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Type:
        return accessor.networkType(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Process:
        return accessor.process(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Host:
        return accessor.host(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Rule:
        return accessor.rule(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Chains:
        return getVisibleChains(accessor, connection, options).join(' → ')
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Outbound:
        return accessor.chains(connection)[0] || ''
      case CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed:
        return `${prettyBytesHelper(connection.downloadSpeed)}/s`
      case CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed:
        return `${prettyBytesHelper(connection.uploadSpeed)}/s`
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Download:
        return prettyBytesHelper(accessor.download(connection))
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Upload:
        return prettyBytesHelper(accessor.upload(connection))
      case CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime:
        return fromNow(accessor.start(connection))
      case CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP:
        return getIPLabelFromMap(accessor.sourceIP(connection))
      case CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort:
        return accessor.sourcePort(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost:
        return accessor.sniffHost(connection) || '-'
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Destination:
        return accessor.destination(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.DestinationType:
        return getDestinationType(accessor.destination(connection))
      case CONNECTIONS_TABLE_ACCESSOR_KEY.GeoIP: {
        const { country, organization } = getConnectionGeoIPInfoSync(
          accessor.destination(connection),
        )

        return [country, organization].filter(Boolean).join(' / ')
      }
      case CONNECTIONS_TABLE_ACCESSOR_KEY.RemoteAddress:
        return accessor.remoteAddress(connection) || '-'
      case CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser:
        return accessor.inboundUser(connection)
      case CONNECTIONS_TABLE_ACCESSOR_KEY.Close:
        return ''
    }
  }

export const createGetConnectionVisibleSearchValues = (accessor: ConnectionAccessor) => {
  const getDisplayValue = createGetConnectionDisplayValue(accessor)
  const searchableKeysCache = new WeakMap<
    CONNECTIONS_TABLE_ACCESSOR_KEY[],
    CONNECTIONS_TABLE_ACCESSOR_KEY[]
  >()

  return (
    connection: Connection,
    keys: CONNECTIONS_TABLE_ACCESSOR_KEY[],
    options: ConnectionDisplayOptions,
  ) => {
    let visibleKeys = searchableKeysCache.get(keys)

    if (!visibleKeys) {
      visibleKeys = keys.filter((key) => key !== CONNECTIONS_TABLE_ACCESSOR_KEY.Close)
      searchableKeysCache.set(keys, visibleKeys)
    }

    return visibleKeys.map((key) => getDisplayValue(connection, key, options))
  }
}
