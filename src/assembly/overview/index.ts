import * as clash from './clash'

export const fetchMemoryAPI = <T>() => clash.fetchMemoryAPI<T>()

export const fetchTrafficAPI = <T>() => clash.fetchTrafficAPI<T>()

export { fetchHonkStats, honkStats, startHonkStats, stopHonkStats } from './stats'
