import type { Provider } from './types'

export type WindowInfo = NonNullable<Provider['quotaWindows']>[number]

export function activeWindows(p:Pick<Provider,'kind'|'quotaWindows'>):WindowInfo[]{
 if(p.kind!=='chatgpt'||!Array.isArray(p.quotaWindows))return []
 return p.quotaWindows.filter(w=>['five-hour','weekly'].includes(w.id)).slice(0,2)
}
export function windowRemaining(w:WindowInfo,now=Date.now()):string{
 const at=Date.parse(w.resetAt||'')
 const seen=Date.parse(w.observedAt||'')
 if(!Number.isFinite(at)||!Number.isFinite(seen)||seen>now+60_000)return '恢复时间未识别'
 if(at<=now)return '等待官方刷新'
 if(w.resetBasis==='countdown'){
  const mins=Math.ceil((at-now)/60000)
  const days=Math.floor(mins/1440),hours=Math.floor((mins%1440)/60),minutes=mins%60
  const summary=[days?days+'天':'',hours?hours+'小时':'',days?'':minutes+'分钟'].filter(Boolean).join('')
  return summary+'后重置'+(now-seen>5*60000?' · 上次识别':'')
 }
 return new Date(at).toLocaleString('zh-CN',w.resetPrecision==='date'
  ?{month:'2-digit',day:'2-digit'}:{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+
  ' 重置'+(now-seen>5*60000?' · 上次识别':'')
}
export function windowPercent(w:WindowInfo):string{
 return typeof w.remainingPercent==='number'&&Number.isFinite(w.remainingPercent)
  ?Math.max(0,Math.min(100,w.remainingPercent)).toLocaleString('zh-CN',{maximumFractionDigits:1})+'%':'--'
}
export const windowShortName=(w:WindowInfo)=>w.id==='five-hour'?'5 小时':'每周'
export function visiblePlan(p:Pick<Provider,'planTier'|'planObservedAt'>):string{
 if(!p.planTier)return '套餐未识别'
 return p.planTier
}
