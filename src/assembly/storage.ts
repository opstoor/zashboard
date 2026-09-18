import {
  deleteStorageAPI as deleteClashStorageAPI,
  getStorageAPI as getClashStorageAPI,
  setStorageAPI as setClashStorageAPI,
} from '@/api/clash'
import { can } from './backend'
import { coreReady } from './version'

export const getStorageAPI = async () => {
  await coreReady()

  if (!can('syncSettings')) return Promise.reject<{ data: Record<string, unknown> }>('unsupported')

  return getClashStorageAPI()
}

export const setStorageAPI = async (value: Record<string, string>) => {
  await coreReady()

  return can('syncSettings') ? setClashStorageAPI(value) : undefined
}

export const deleteStorageAPI = async () => {
  await coreReady()

  return can('syncSettings') ? deleteClashStorageAPI() : undefined
}
