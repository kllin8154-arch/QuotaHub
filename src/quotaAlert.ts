import type { Provider } from './types'
import { syncHealth } from './syncHealth'

// Quota alerts require fresh, authorized data. Native % values do not need a
// manually entered budget; monetary/token amounts do.
export function quotaAlertDetail(p: Provider, now = Date.now()): string | null {
 if(!p.alertEnabled || syncHealth(p,now)!=='healthy') return null
 const threshold=p.alertPercent ?? (p.metric==='balance'?20:80)
 if(!Number.isFinite(threshold)||threshold<1||threshold>99)return null
 const within=(n:number)=>n>=0&&n<=100&&Number.isFinite(n)
 if(p.kind==='chatgpt' && p.quotaWindows?.length){
  for(const w of p.quotaWindows){
   const observed=Date.parse(w.observedAt||'')
   if(!Number.isFinite(observed)||observed>now+60_000||now-observed>5*60_000)continue
   if(w.remainingPercent!==null && within(w.remainingPercent) && w.remainingPercent<=threshold)
    return w.label+' · 剩余 '+w.remainingPercent+'%'
  }
  // Distinct official allowance windows must not be merged into one invented limit.
  return null
 }
 if(p.value===null||!Number.isFinite(p.value)||p.value<0)return null
 const ratio=p.unit==='%'? (within(p.value)?p.value:null):
  p.limit!==null && Number.isFinite(p.limit) && p.limit>0 ? 100*p.value/p.limit:null
 if(ratio===null)return null
 const low=p.metric==='balance'
 const triggered=low?ratio<=threshold:ratio>=threshold
 return triggered?(low?'剩余':'已用')+Math.round(ratio*10)/10+'%':null
}
export function quotaAlert(p:Provider,now=Date.now()):boolean{
 return quotaAlertDetail(p,now)!==null
}
