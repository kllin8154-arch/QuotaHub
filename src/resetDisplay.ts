import type { Provider } from './types'

// Display only independently observed official quota reset information.
// Legacy manually entered "reset" is intentionally ignored.
export function quotaResetLabel(p: Pick<Provider,'category'|'resetAt'|'resetObservedAt'|'resetBasis'|'resetPrecision'|'error'>, now=Date.now()): string | null {
 if(p.category!=='订阅')return null
 const at=Date.parse(p.resetAt||'')
 const observed=Date.parse(p.resetObservedAt||'')
 if(!Number.isFinite(at)||!Number.isFinite(observed)||observed>now+60_000||at<=now)
  return '恢复时间：官方暂未提供'
 const formatted=new Intl.DateTimeFormat('zh-CN',p.resetPrecision==='date'
  ?{year:'numeric',month:'2-digit',day:'2-digit'}
  :{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at))
 const stale=now-observed>5*60_000||!!p.error
 const prefix=p.resetBasis==='countdown'?'预计恢复':'官方恢复'
 return prefix+'：'+formatted+(stale?' · 上次识别':'')
}
