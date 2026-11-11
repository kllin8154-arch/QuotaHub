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

// Only return whitelist messages: provider errors may contain tokens and cookie headers.
export function safeErrorText(error: unknown): string {
  const reason = String(error instanceof Error ? error.message : error ?? '').toLowerCase()
  if (/401|403|unauthori[sz]ed|forbidden|login|sign.in|session|cookie|token.expir|认证|登录|授权|会话/.test(reason))
    return '平台授权可能已失效，请在官方页面重新登录后刷新。'
  if (/429|rate.limit|too.many|限制了请求频率|频率|限流/.test(reason))
    return '平台限制了请求频率，请稍后再刷新。'
  if (/timeout|timed.out|network|net::|econn|enotfound|网络|超时|连接/.test(reason))
    return '网络连接或官网访问异常，请检查网络后刷新。'
  if (/selector|extract|parse|signature|匹配|解析|页面结构|页面可能已调整/.test(reason))
    return '官方页面可能已调整，需要重新选择用量数据。'
  return '本次采集失败，已保留上次成功数据；请刷新或检查平台官网。'
}

export function syncDiagnostic(source: Pick<Provider, 'connected' | 'webMonitored' | 'updatedAt' | 'error'>, now = Date.now()): string | null {
  const health = syncHealth(source, now)
  if (health === 'healthy' || health === 'manual') return null
  if (health === 'pending') return '尚无有效额度数据，请刷新；如未登录，请先完成平台官网授权。'
  if (health === 'delayed') return '最近一次有效数据已超过 5 分钟，请刷新并检查网络或登录状态。'
  return safeErrorText(source.error)
}

export function lastSampleText(updatedAt?: string, now = Date.now()): string {
  const at = Date.parse(updatedAt || '')
  if (!Number.isFinite(at)) return '尚无有效采样'
  const minutes = Math.max(0, Math.floor((now - at) / 60_000))
  return minutes < 1 ? '刚刚成功采集' : minutes < 60 ? `${minutes} 分钟前采集`
    : new Date(at).toLocaleString('zh-CN')
}
