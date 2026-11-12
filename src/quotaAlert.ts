import type { Provider } from './types'
import { syncHealth } from './syncHealth'

// No opt-in, valid reference limit or fresh authorized data means no quota alert.
export function quotaAlert(p: Provider, now = Date.now()): boolean {
 if (!p.alertEnabled || syncHealth(p, now) !== 'healthy') return false
 if (p.value === null || !Number.isFinite(p.value) || p.value < 0 ||
  p.limit === null || !Number.isFinite(p.limit) || p.limit <= 0) return false
 const percentage = p.alertPercent ?? (p.metric === 'balance' ? 20 : 80)
 if (!Number.isFinite(percentage) || percentage < 1 || percentage > 99) return false
 const used = 100 * p.value / p.limit
 return p.metric === 'balance' ? used <= percentage : used >= percentage
}
