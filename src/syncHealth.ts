import type { Provider } from './types'

export type SyncHealth = 'healthy' | 'delayed' | 'error' | 'pending' | 'manual'

// A source is only live when it has successfully produced a recent sample.
// Google identity association by itself is NOT a live quota connection.
export function syncHealth(
  source: Pick<Provider, 'connected' | 'webMonitored' | 'updatedAt' | 'error'>,
  now = Date.now()
): SyncHealth {
  if (!source.connected && !source.webMonitored) return 'manual'
  if (source.error) return 'error'
  const last = Date.parse(source.updatedAt || '')
  if (!Number.isFinite(last) || last > now + 60_000) return 'pending'
  if (now - last > 5 * 60_000) return 'delayed'
  return 'healthy'
}

export function lastSampleText(updatedAt?: string, now = Date.now()): string {
  const at = Date.parse(updatedAt || '')
  if (!Number.isFinite(at)) return '尚无有效采样'
  const minutes = Math.max(0, Math.floor((now - at) / 60_000))
  return minutes < 1 ? '刚刚成功采集' : minutes < 60 ? `${minutes} 分钟前采集`
    : new Date(at).toLocaleString('zh-CN')
}
