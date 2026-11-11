import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, Bell, Check, ChevronRight, CircleHelp, Clock3, Cloud, CreditCard, Download, ExternalLink, Gauge, LayoutDashboard, Menu, MoreHorizontal, Plus, RefreshCcw, Search, Settings2, ShieldCheck, TrendingUp, Wallet, Wifi, X, Zap } from 'lucide-react'
import type { Provider, ProviderKind, LiveResult, Metric } from './types'
import { definitions } from './catalog'
import ReadableSelect from './ReadableSelect'
import HistoryChart from './HistoryChart'
import IdentityPanel from './IdentityPanel'
import type { WebQuotaCandidate, GoogleIdentityState } from './types'
import type { RelayConfig } from './types'

type Section = 'overview' | 'providers' | 'insights' | 'settings'
type Editor = { type: 'edit' | 'new'; id?: string }
type Draft = { kind: ProviderKind; name: string; account: string; category: 'API' | '订阅'; metric: Metric; value: string; limit: string; unit: string; reset: string; note: string; relayUrl: string; relayMode:'newapi-account'|'newapi-key'|'custom'; relayUserId:string; relayPath:string; relayField:string; relayUnit:string; relayDivisor:string }
const KEY = 'aiquotahub.providers.v1'
const isLiveKind = (kind:ProviderKind) => kind==='deepseek'||kind==='openai-api'||kind==='openrouter'||kind==='relay'
const navItems: { id: Section; name: string; icon: typeof LayoutDashboard }[] = [
 { id: 'overview', name: '总览', icon: LayoutDashboard },
 { id: 'providers', name: '我的平台', icon: Wallet },
 { id: 'insights', name: '额度趋势', icon: TrendingUp },
 { id: 'settings', name: '偏好设置', icon: Settings2 }
]
const emptyDraft: Draft = { kind: 'custom', name: '', account: '', category: 'API', metric: 'balance', value: '', limit: '', unit: 'CNY', reset: '', note: '', relayUrl:'',relayMode:'newapi-account',relayUserId:'',relayPath:'/api/user/self',relayField:'data.balance',relayUnit:'额度点',relayDivisor:'1' }
function isFactoryPlaceholder(p: Provider): boolean {
 const template=definitions.find(d=>d.kind===p.kind)
 return !!template && p.id===p.kind && p.name===template.name &&
   !p.account && !p.note && !p.reset && p.value == null && p.limit == null &&
   !p.connected && !p.updatedAt && !p.daily?.length && p.bonus == null
}
function loadSaved(): Provider[] {
 try {
  const raw=JSON.parse(localStorage.getItem(KEY)||'null')
  if(Array.isArray(raw))return raw.filter(p=>p && typeof p.id==='string' && typeof p.name==='string')
 } catch { /* invalid local storage; show an empty list */ }
 return []
}
function formatNumber(n: number): string {
 return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n)
}
function valueText(p: Provider): string {
 if (p.value == null) return '--'
 const prefix = p.unit === 'CNY' ? '¥' : p.unit === 'USD' ? '$' : ''
 return prefix + formatNumber(p.value)
}
function metricText(p: Provider): string {
 return p.unit==='%' ? (p.metric==='balance'?'当前剩余使用比例':'当前已使用比例') :
   p.metric === 'balance' ? '当前可用余额' : p.metric === 'spend' ? '本月 API 费用' : '本周期已使用'
}
function threshold(p: Provider) {
 if (p.value == null || p.limit == null || p.limit <= 0) return -1
 const ratio = p.value / p.limit
 return p.metric === 'balance' ? 1 - ratio : ratio
}
function goTo(url: string) {
 if (window.quotaBridge) void window.quotaBridge.openExternal(url)
 else window.open(url, '_blank', 'noopener,noreferrer')
}
function ProviderCard({ data, isDemo, onEdit, onRefresh }: { data: Provider; isDemo: boolean; onEdit: (p: Provider) => void; onRefresh: (p: Provider) => void }) {
 const info = definitions.find(x => x.kind === data.kind)
 const risk = threshold(data)
 const ratio = data.value != null && data.limit != null && data.limit > 0 ? Math.min(100, Math.max(0, data.value / data.limit * 100)) : null
 const hasData = data.value != null
 return <article className={'provider-card hue-' + (info?.hue || 'slate') + (risk >= 0.8 ? ' card-warning' : '')}>
  <div className="card-top">
   <div className="provider-emblem">{data.kind==='relay'?<Wallet size={22}/>:<img src={'./provider-icons/'+(data.kind==='chatgpt'||data.kind==='openai-api'?'openai':data.kind==='qwen'?'qwen':data.kind)+'.svg'} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>}</div>
   <div className="card-actions">
    {(data.connected||data.webMonitored) && !isDemo && <button title="刷新实时数据" className="icon-button small" onClick={() => onRefresh(data)}><RefreshCcw size={15}/></button>}
    <button title="管理平台" className="icon-button small" onClick={() => onEdit(data)}><MoreHorizontal size={21}/></button>
   </div>
  </div>
  <div className="provider-intro">
   <div className="eyebrow">{data.category === 'API' ? 'API 服务' : '订阅服务'}</div>
   <h3>{data.name}</h3>
   <p>{data.account ? '账号 · ' + data.account : info?.tagline || data.note || '自定义平台用量追踪'}</p>
  </div>
  <div className="provider-metric">
   <span className="label-muted">{metricText(data)}</span>
   <div className="metric-main"><strong>{valueText(data)}</strong>{hasData && <span className="metric-unit">{data.unit === 'CNY' ? 'CNY' : data.unit === 'USD' ? 'USD' : data.unit}</span>}</div>
   {ratio !== null ? <><div className="progress-track"><div style={{ width: ratio + '%' }}/></div><div className="progress-hint"><span>{data.metric === 'balance' ? '剩余占参考上限' : '已用占参考上限'} {Math.round(ratio)}%</span><span>参考 {formatNumber(data.limit!)}</span></div></> : <div className="progress-empty">{hasData ? '未设置参考上限' : '配置后即可开始追踪'}</div>}
  </div>
  {!!data.updatedAt && <div className="provider-source-tag">{data.error?'采集暂停 · 显示最后成功值':'最近采集 '+new Date(data.updatedAt).toLocaleString('zh-CN')}</div>}
  <div className="card-bottom">
   <div className="status-with-dot"><span className={'dot ' + (isDemo ? 'dot-demo' : data.webMonitored||data.connected ? 'dot-online' : hasData ? 'dot-manual' : 'dot-off')}></span>{data.webMonitored?'网页监测':data.connected?'API 同步':hasData?'手动记录':'尚未配置'}</div>
   <button onClick={() => onEdit(data)} className="card-link">{data.connected||data.webMonitored ? '已绑定' : '绑定 / 管理'} <ArrowUpRight size={15}/></button>
  </div>
 </article>
}
function App() {
 const [items, setItems] = useState<Provider[]>(loadSaved)
 const [section, setSection] = useState<Section>('overview')
 const [query, setQuery] = useState('')
 const [category, setCategory] = useState('全部')
 const demoMode = false
 const [glassTone, setGlassTone] = useState<'smoke'|'clear'|'warm'>(() => {
  const choice=localStorage.getItem('aiquotahub.ui.tone');
  return choice==='clear'||choice==='warm'?choice:'smoke';
 })
 const [editor, setEditor] = useState<Editor | null>(null)
 const [draft, setDraft] = useState<Draft>(emptyDraft)
 const [secret, setSecret] = useState('')
 const [busy, setBusy] = useState(false)
 const [refreshing, setRefreshing] = useState(false)
 const [toast, setToast] = useState('')
 const [sidebar, setSidebar] = useState(false)
 const [historyRevision,setHistoryRevision] = useState(0)
 const [identityOpen,setIdentityOpen]=useState(false)
 const [googleIdentity,setGoogleIdentity]=useState<GoogleIdentityState|null>(null)
 const [accountSyncReady,setAccountSyncReady] = useState(!window.quotaBridge)
 const [webCandidates,setWebCandidates] = useState<WebQuotaCandidate[]>([])
 const [selectedWeb,setSelectedWeb] = useState('')
 const [webBusy,setWebBusy] = useState(false)
 const [webStatus,setWebStatus] = useState('')
 const [webError,setWebError] = useState(false)
 const desktop = !!window.quotaBridge
 const isAndroid = Capacitor.getPlatform() === 'android'
 const viewing = items
 const filtered = viewing.filter(p => (category === '全部' || (category === '需关注' ? threshold(p) >= 0.8 : p.category === category)) && (p.name + ' ' + p.note).toLowerCase().includes(query.toLowerCase()))
 const activeCount = viewing.filter(x => x.value != null).length
 const connectedCount = items.filter(x => x.connected || x.webMonitored).length
 const warnings = viewing.filter(x => threshold(x) >= 0.8)
 const configured = viewing.filter(x => x.value != null)
 const nextReset = viewing.filter(x => x.reset && new Date(x.reset).getTime() >= Date.now()).sort((a,b) => (a.reset || '').localeCompare(b.reset || ''))[0]
 const platformChoices = definitions
 useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])
 useEffect(()=>{
  let mounted=true
  if(!window.quotaBridge?.identityStatus)return
  void window.quotaBridge.identityStatus().then(state=>{if(mounted)setGoogleIdentity(state)}).catch(()=>{})
  const unsubscribe=window.quotaBridge.onIdentity?.(state=>{if(mounted)setGoogleIdentity(state)})
  return ()=>{mounted=false;unsubscribe?.()}
 },[])
 useEffect(() => {
   if(!accountSyncReady||!window.quotaBridge?.updateWidgetAccounts)return
   void window.quotaBridge.updateWidgetAccounts(items.map(p=>({
    id:p.id,name:p.name,account:p.account,kind:p.kind,value:p.value,unit:p.unit,metric:p.metric,updatedAt:p.updatedAt,connected:p.connected||p.webMonitored,webMonitored:p.webMonitored,source:p.source
   }))).catch(()=>{})
 },[items,accountSyncReady])

 useEffect(() => {
  if(!window.quotaBridge){
    setItems(previous=>previous.filter(p=>!isFactoryPlaceholder(p)))
    return
  }
  void Promise.all([window.quotaBridge.connected(),window.quotaBridge.webBindings?.()??Promise.resolve({} as Record<string,{kind:ProviderKind;signature:string;metric:Metric;unit:string;name?:string;last?:{value:number;at:string;unit:string;metric:Metric}|null}>)])
    .then(([ids,bindings])=>{
      setItems(previous=>{
       const list=previous.filter(p=>!(isFactoryPlaceholder(p)&&!ids.includes(p.id)&&!bindings[p.id]))
        .map(p=>{
         const b=bindings[p.id]
         const newer=b?.last && Date.parse(b.last.at)>=Date.parse(p.updatedAt||'1970-01-01')
         return {...p,connected:ids.includes(p.id),webMonitored:!!b,
          source:b?'web':ids.includes(p.id)?'api':p.source,
          ...(newer?{value:b.last!.value,unit:b.last!.unit,metric:b.last!.metric,updatedAt:b.last!.at}: {})}
        })
       for(const [id,b] of Object.entries(bindings)){
        if(list.some(p=>p.id===id))continue
        const def=definitions.find(p=>p.kind===b.kind)
        list.push({id,kind:b.kind,name:b.name||def?.name||b.kind,
         account:'',category:def?.category||'API',mode:'live',
         metric:b.last?.metric||b.metric,unit:b.last?.unit||b.unit,
         value:b.last?.value??null,limit:null,connected:ids.includes(id),
         webMonitored:true,source:'web',updatedAt:b.last?.at})
       }
       return list
      })
    })
    .catch(()=>{/* keep locally saved entries if backend does not respond */})
    .finally(()=>setAccountSyncReady(true))
 },[])
 useEffect(() => { localStorage.setItem('aiquotahub.ui.tone',glassTone) },[glassTone])
 useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4200); return () => clearTimeout(t) }, [toast])
 useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.qh-readable-options')) setEditor(null) }; window.addEventListener('keydown',fn); return () => window.removeEventListener('keydown',fn) }, [])
 useEffect(()=>{
  if(!window.quotaBridge?.onSnapshot)return
  return window.quotaBridge.onSnapshot(message=>{
   if(message.type==='linked'){
    const point=message.point
    const p=message.provider
    setItems(list=>{
     const exists=list.some(x=>x.id===p.id)
     return exists?list.map(x=>x.id===p.id?
       {...x,value:point.value,limit:point.limit,unit:point.unit,metric:point.metric,
        webMonitored:true,source:'web',updatedAt:point.at,error:''}:x):
       [...list,{id:p.id,kind:p.kind,name:p.name,account:'',category:p.category,
        mode:'live',metric:p.metric,unit:p.unit,value:p.value,limit:point.limit,
        connected:false,webMonitored:true,source:'web',updatedAt:point.at}]
    })
    setHistoryRevision(n=>n+1)
    setEditor(x=>x?.id===p.id?null:x)
    setToast(p.name+' 已自动绑定，余额同步成功')
   }else if(message.type==='snapshot'){
    const p=message.point
    setItems(items=>items.map(x=>x.id===p.id?{...x,value:p.value,limit:p.limit??x.limit,
      metric:p.metric,unit:p.unit,connected:p.source==='api'?true:x.connected,
      source:p.source,webMonitored:p.source==='web'?true:x.webMonitored,updatedAt:p.at,error:''}:x))
    setHistoryRevision(n=>n+1)
   } else {
    setItems(items=>items.map(x=>x.id===message.id?{...x,error:message.reason}:x))
   }
  })
 },[])
 function edit(p: Provider) {
  setDraft({...emptyDraft,kind:p.kind,name:p.name,account:p.account || '',category:p.category,metric:p.metric,value:p.value == null ? '' : String(p.value),limit:p.limit == null ? '' : String(p.limit),unit:p.unit,reset:p.reset || '',note:p.note || '',relayUrl:p.relay?.baseUrl||'',relayMode:p.relay?.mode||'newapi-account',relayUserId:p.relay?.userId||'',relayPath:p.relay?.path||'/api/user/self',relayField:p.relay?.field||'data.balance',relayUnit:p.relay?.unit||'额度点',relayDivisor:String(p.relay?.divisor||1)})
  setSecret('');setWebCandidates([]);setSelectedWeb('');setWebStatus('');setWebError(false);
  setEditor({type:'edit',id:p.id});setSidebar(false)
  if(desktop && ['chatgpt','deepseek'].includes(p.kind) && !p.webMonitored){
   setWebStatus('官方额度页正在打开。登录完成后自动绑定，无需点击读取或保存。')
   void window.quotaBridge?.webOpen?.(p.kind,p.id).catch(e=>setWebStatus('打开页面失败：'+String(e)))
  }
 }
 function add() {
  const first = definitions.find(def => def.kind === 'relay')
  const info = first || definitions[0]
  setDraft({ ...emptyDraft, kind: first?.kind || 'custom', name:first?.name || '', category:info.category,metric:info.metric,unit:info.unit })
  setSecret('');setWebCandidates([]);setSelectedWeb('');setWebStatus('');setWebError(false);
  setEditor({type:'new',id:'qh-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)});setSidebar(false)
 }
 function selectKind(kind: ProviderKind) {
  const info = definitions.find(x=>x.kind===kind)
  setWebCandidates([]);setSelectedWeb('');setWebStatus('');setWebError(false)
  setDraft(p=>({...p,kind,name:info?.name || '',category:info?.category || 'API',metric:info?.metric || 'balance',unit:info?.unit || 'CNY'}))
  if(desktop && editor?.id && ['chatgpt','deepseek'].includes(kind)){
   setWebStatus('官方额度页正在打开。登录完成后自动绑定并持续同步，不需要手动操作。')
   void window.quotaBridge?.webOpen?.(kind,editor.id).catch(e=>setWebStatus('打开页面失败：'+String(e)))
  }
 }
 async function openWebUsage(){
  if(!editor?.id || !window.quotaBridge?.webOpen){setToast('网页登录采集仅在 Windows 桌面版可用');return}
  setWebBusy(true);setWebStatus('正在打开官方额度页面…');setWebError(false)
  try{
   await window.quotaBridge.webOpen(draft.kind,editor.id)
   setWebStatus(['chatgpt','deepseek'].includes(draft.kind)?
      '仅需在官网登录。Agnovexa One 会自动识别额度、关联账号并定时记录变化。':
      '在官方网页登录后，可点击读取页面额度。')
  }catch(e){setWebError(true);setWebStatus(e instanceof Error?e.message:String(e))}
  finally{setWebBusy(false)}
 }
 async function readWebUsage(){
  if(!editor?.id || !window.quotaBridge?.webRead)return
  setWebBusy(true);setWebError(false);setWebStatus('正在读取当前页面的可见额度…')
  try{
   const result=await window.quotaBridge.webRead(draft.kind,editor.id)
   setWebCandidates(result.candidates);setSelectedWeb('')
   setWebStatus('找到 '+result.candidates.length+' 项候选数据。请选择对应的余额或用量指标，保存后每 90 秒尝试同步。')
  }catch(e){setWebError(true);setWebStatus(e instanceof Error?e.message:String(e));setWebCandidates([])}
  finally{setWebBusy(false)}
 }
 async function stopWebMonitor(){
  if(!editor?.id || !window.quotaBridge?.webUnbind)return
  try{
   await window.quotaBridge.webUnbind(editor.id)
   updateProvider(editor.id,{webMonitored:false,error:'',connected:false})
   setSelectedWeb('');setWebCandidates([]);setWebStatus('已停止网页监测，并清理此账号的隔离网页登录会话。')
  }catch(e){setToast('停止监测失败：'+String(e))}
 }
 function updateProvider(id: string, changes: Partial<Provider>) { setItems(list=>list.map(p=>p.id===id?{...p,...changes}:p)) }
 async function refreshOne(p: Provider, quiet=false) {
  if(!window.quotaBridge)return
  if(p.webMonitored){
   if(!window.quotaBridge.webSample){setToast('网页监测需要 Windows 桌面版');return}
   try{
    const result=await window.quotaBridge.webSample(p.kind,p.id)
    updateProvider(p.id,{value:result.value,unit:result.unit,metric:result.metric,source:'web',updatedAt:result.at,error:''})
    setHistoryRevision(n=>n+1)
    if(!quiet)setToast(p.name+' · 网页额度已更新')
   }catch(e){if(!quiet)setToast(p.name+' · '+String(e))}
   return
  }
  if(!isLiveKind(p.kind))return
  try {
   const value = await window.quotaBridge.refresh(p.kind, p.id)
   updateProvider(p.id, {...value, connected:true,source:'api', error:''})
   void window.quotaBridge.historyRecord?.({id:p.id,value:value.value,unit:value.unit,
    metric:value.metric,source:'api',limit:p.limit}).then(()=>setHistoryRevision(n=>n+1)).catch(()=>{})
   if (!quiet) setToast(p.name + ' · 更新成功')
  } catch(e) {
   const msg = e instanceof Error ? e.message : String(e)
   updateProvider(p.id, {error:msg})
   if (!quiet) setToast(p.name + ' · ' + msg)
  }
 }
 async function refreshAll(quiet=false) {
  if (!desktop || refreshing) { if (!quiet) setToast('桌面端支持实时刷新，网页端可手动更新'); return }
  setRefreshing(true)
  const live = items.filter(p => p.webMonitored || p.connected && isLiveKind(p.kind))
  await Promise.all(live.map(p => refreshOne(p, true)))
  setRefreshing(false)
  if (!quiet) setToast(live.length ? '已完成 ' + live.length + ' 个平台的同步' : '尚未连接可自动刷新的平台')
 }
 async function save() {
  if (!draft.name.trim()) { setToast('请输入平台名称'); return }
  const value = draft.value.trim() === '' ? null : Number(draft.value)
  const limit = draft.limit.trim() === '' ? null : Number(draft.limit)
  if ((value !== null && (!Number.isFinite(value) || value < 0)) || (limit !== null && (!Number.isFinite(limit) || limit <= 0))) { setToast('额度和参考上限必须为有效的非负数字');return }
  const old = items.find(x=>x.id===editor?.id)
  const id = editor?.id || draft.kind+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)
  const liveCapable = isLiveKind(draft.kind)
  if (secret && ((!desktop || !liveCapable))) {setToast('当前环境不支持安全的凭据连接');return}
  setBusy(true)
  try {
   let live: LiveResult | null = null
   const relay:RelayConfig|undefined=draft.kind==='relay'?{baseUrl:draft.relayUrl.trim(),mode:draft.relayMode,userId:draft.relayUserId.trim(),path:draft.relayPath.trim(),field:draft.relayField.trim(),unit:draft.relayUnit.trim(),divisor:Number(draft.relayDivisor||1)}:undefined
   if (secret.trim() && window.quotaBridge && liveCapable) live = await window.quotaBridge.connect(draft.kind as 'deepseek' | 'openai-api' | 'openrouter' | 'relay', id, secret.trim(),relay)
   let webResult:{id:string;kind:ProviderKind;value:number;limit:number|null;unit:string;metric:Metric;at:string;source:'web'}|null=null
   if(selectedWeb && window.quotaBridge?.webBind){
    const candidate=webCandidates.find(c=>c.signature===selectedWeb)
    if(!candidate)throw new Error('请选择需要跟踪的网页指标')
    webResult=await window.quotaBridge.webBind(draft.kind,id,candidate)
   }
   const record: Provider = {
    id,kind:draft.kind,name:draft.name.trim(),account:draft.account.trim(),category:draft.category,
    mode: (liveCapable && desktop || !!webResult || !!old?.webMonitored) ? 'live' : 'manual',
    metric:webResult?.metric || live?.metric || draft.metric,
    unit:webResult?.unit || live?.unit || draft.unit,
    value:webResult?.value ?? live?.value ?? value,limit:webResult?.limit ?? limit,
    reset:draft.reset || undefined,note:draft.note.trim(),connected:!!live || !!old?.connected,
    webMonitored:!!webResult||!!old?.webMonitored,source:webResult?'web':live?'api':old?.source||'manual',
    updatedAt:webResult?.at||live?.updatedAt || (value !== null ? new Date().toISOString() : old?.updatedAt),
    daily:live?.daily || old?.daily,bonus:live?.bonus ?? old?.bonus,error:'', relay:relay||old?.relay
   }
   setItems(prev=>old?prev.map(x=>x.id===id?record:x):[...prev,record])
   if(!webResult && !live && value!==null && window.quotaBridge?.historyRecord){
    void window.quotaBridge.historyRecord({id,value,unit:draft.unit,metric:draft.metric,
      source:'manual',limit}).then(()=>setHistoryRevision(n=>n+1)).catch(()=>{})
   }
   if(live && window.quotaBridge?.historyRecord)
    void window.quotaBridge.historyRecord({id,value:live.value,unit:live.unit,
      metric:live.metric,source:'api',limit}).then(()=>setHistoryRevision(n=>n+1)).catch(()=>{})
   setEditor(null);setSecret('');setWebCandidates([]);setSelectedWeb('')
   setToast(webResult?'官网额度已绑定 · 每 90 秒自动监测':live?'安全连接成功 · 已获取实时数据':'已保存平台配置')
  } catch(e) {
   setToast('连接失败 · ' + (e instanceof Error ? e.message : String(e)))
  } finally { setBusy(false) }
 }
 async function disconnect() {
  if (!editor?.id) return
  const p=items.find(x=>x.id===editor.id)
  if (!p || !window.quotaBridge || !isLiveKind(p.kind)) return
  await window.quotaBridge.disconnect(p.kind, p.id)
  updateProvider(p.id,{connected:false})
  setToast('已断开密钥连接')
 }
 function remove() {
  if (!editor?.id) return
  if(items.find(x=>x.id===editor.id)?.webMonitored)
   void window.quotaBridge?.webUnbind?.(editor.id).catch(()=>{})
  const p=items.find(x=>x.id===editor.id)
  if (p?.connected) {setToast('请先断开 API 密钥再移除平台');return}
  setItems(prev=>prev.filter(x=>x.id!==editor.id))
  setEditor(null);setToast('平台已移除')
 }
 function exportData() {
  const a = document.createElement('a'), blob = new Blob([JSON.stringify({version:1,createdAt:new Date().toISOString(),providers:items.map(p=>({...p,connected:false}))},null,2)],{type:'application/json'})
  a.href=URL.createObjectURL(blob);a.download='AIAgnovexa One-额度记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
  setToast('已导出额度记录（不包含密钥）')
 }
 function switchSection(next:Section) {setSection(next);setSidebar(false);setCategory('全部');setQuery('')}
 const topCards = [...viewing].sort((a,b)=>Number(b.value!=null)-Number(a.value!=null)).slice(0,4)
 return <div className={'shell quota-refined tone-'+glassTone}>
  <aside className={'sidebar '+(sidebar?'sidebar-open':'')}>
   <button className="brand" onClick={()=>switchSection('overview')}><span className="brand-mark"><img src="./icon.svg" alt="" aria-hidden="true"/></span><span>Agnovexa One<small>AI 额度与订阅监测</small></span></button>
   <div className="sidebar-group"><span className="group-heading">工作区</span>
    <nav>{navItems.map(item=><button key={item.id} className={'nav-item '+(section===item.id?'nav-active':'')} onClick={()=>switchSection(item.id)}><item.icon size={19}/><span>{item.name}</span>{section===item.id && <span className="nav-active-indicator"/>}</button>)}</nav>
   </div>
   <div className="sidebar-group side-categories"><span className="group-heading">快捷入口</span>
    <button className="side-filter" onClick={()=>{switchSection('providers');setCategory('API')}}><span className="filter-icon api"><Zap size={16}/></span><span>API 额度</span><span className="count">{items.filter(x=>x.category==='API').length}</span></button>
    <button className="side-filter" onClick={()=>{switchSection('providers');setCategory('订阅')}}><span className="filter-icon sub"><CreditCard size={16}/></span><span>订阅计划</span><span className="count">{items.filter(x=>x.category==='订阅').length}</span></button>
   </div>
   <div className="sidebar-bottom">
    <div className="privacy-tile"><ShieldCheck size={19}/><strong>本地优先</strong><p>配置保存在本机。密钥仅在桌面端加密保存。</p></div>
    <div className="profile"><div className="profile-avatar"><Wallet size={19}/></div><div><strong>我的工作台</strong><small>{isAndroid?'Android 安全连接':'Windows 桌面端 / Web 模式'}</small></div><span className="profile-status"/></div>
   </div>
  </aside>
  {sidebar && <button className="mobile-shade" onClick={()=>setSidebar(false)} aria-label="关闭菜单"/>}
  <div className="page">
   <header className="topbar">
    <div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setSidebar(!sidebar)} aria-label="展开菜单"><Menu size={22}/></button><span className="breadcrumb">Agnovexa One <ChevronRight size={13}/> <b>{navItems.find(x=>x.id===section)?.name}</b></span></div>
    <div className="topbar-right"><div className="tone-picker" aria-label="玻璃面板配色">
      <button title="烟灰" aria-label="烟灰玻璃" className={glassTone==='smoke'?'selected':''} onClick={()=>setGlassTone('smoke')}><i className="tone-dot smoke"/></button>
      <button title="冰白" aria-label="冰白玻璃" className={glassTone==='clear'?'selected':''} onClick={()=>setGlassTone('clear')}><i className="tone-dot clear"/></button>
      <button title="暖灰" aria-label="暖灰玻璃" className={glassTone==='warm'?'selected':''} onClick={()=>setGlassTone('warm')}><i className="tone-dot warm"/></button>
    </div><span className="topbar-mode"><span className="pulse-dot"/>{isAndroid?'Android Connected':desktop?'Desktop Connected':'Web Preview'}</span><button className="icon-button top-icon" title="帮助" onClick={()=>switchSection('settings')}><CircleHelp size={20}/></button><button className="icon-button top-icon" title="查看需要关注的平台" onClick={()=>{switchSection('providers');setCategory('需关注')}}><Bell size={19}/>{warnings.length>0 && <span className="notif-dot"/>}</button><button className="identity-account-trigger" title="身份与 Google 登录" onClick={()=>setIdentityOpen(true)}>
      {googleIdentity?.profile?<img src="./google-mark.svg" alt=""/>:<ShieldCheck size={17}/>}
      <span>{googleIdentity?.profile?.name||'本地模式'}</span>
     </button></div>
   </header>
   <main className="main">
    {section==='overview' && <>
     <div className="refined-heading">
       <div><span className="section-kicker">配额管理</span><h1>总览</h1><p>查看各平台余额、使用情况及账号状态</p></div>
       <div className="refined-actions">
        <button className="outline-button" onClick={()=>void refreshAll()}><RefreshCcw size={16}/>刷新数据</button>
        <button className="primary-button smaller" onClick={add}><Plus size={16}/>绑定账号</button>
       </div>
     </div>
     <section className="stats-grid">
      <div className="stat-card"><div className="stat-heading"><span>已添加平台</span><span className="stat-icon"><LayoutDashboard size={18}/></span></div><div className="stat-value">{viewing.length.toString().padStart(2,'0')}<span>个平台</span></div><div className="stat-foot"><span className="tiny-dot lime"/> 多平台统一总览</div></div>
      <div className="stat-card"><div className="stat-heading"><span>已配置额度</span><span className="stat-icon"><Gauge size={18}/></span></div><div className="stat-value">{activeCount.toString().padStart(2,'0')}<span>个平台</span></div><div className="stat-foot"><span className="tiny-dot sky"/> 包含实时与手动记录</div></div>
      <div className="stat-card"><div className="stat-heading"><span>实时连接</span><span className="stat-icon"><Cloud size={18}/></span></div><div className="stat-value">{connectedCount.toString().padStart(2,'0')}<span>个连接</span></div><div className="stat-foot"><span className="tiny-dot lime"/> 桌面端 / Android 支持安全连接</div></div>
      <div className="stat-card"><div className="stat-heading"><span>额度预警</span><span className="stat-icon"><Bell size={18}/></span></div><div className="stat-value">{warnings.length.toString().padStart(2,'0')}<span>项需关注</span></div><div className="stat-foot"><span className={'tiny-dot '+(warnings.length?'coral':'lime')}/> {warnings.length?'超过 80% 的风险阈值':'所有已录入平台状态正常'}</div></div>
     </section>
     <div className="section-heading"><div><div className="section-kicker">平台与账号</div><h2>我的平台 <span className="heading-count">{viewing.length}</span></h2><p>追踪你最常用的平台和服务额度</p></div><div className="section-tools"><button className="text-button" onClick={()=>void refreshAll()}><RefreshCcw className={refreshing?'spin':''} size={16}/>刷新</button><button className="text-button" onClick={()=>switchSection('providers')}>查看全部 <ArrowRight size={16}/></button></div></div>
     {topCards.length ? <div className="card-grid featured-grid">{topCards.map(p=><ProviderCard key={p.id} data={p} isDemo={demoMode} onEdit={edit} onRefresh={p=>void refreshOne(p)}/>)}</div> :
     <div className="empty-onboarding"><Wallet size={25}/><div><strong>尚未绑定任何平台</strong><p>选择 DeepSeek、OpenAI API 或中转站，连接后在看板与桌面组件查看余额。</p></div><button className="primary-button smaller" onClick={add}><Plus size={16}/>绑定第一个账号</button></div>}
     <section className="bottom-grid"><div className="activity-panel"><div className="panel-title"><div><span className="section-kicker">同步记录</span><h3>平台状态</h3></div><span className="panel-annotation">最近更新</span></div>
       {configured.length ? configured.slice(0,5).map(p=>{const def=definitions.find(d=>d.kind===p.kind);return <div className="activity-line" key={p.id}><span className={'activity-symbol hue-'+(def?.hue||'slate')}>{p.kind==='relay'?<Wallet size={16}/>:<img alt="" src={'./provider-icons/'+(['chatgpt','openai-api'].includes(p.kind)?'openai':p.kind)+'.svg'} />}</span><div className="activity-copy"><strong>{p.name}</strong><small>{p.webMonitored?'官网登录监测':p.connected?'官方接口同步':'本地手动记录'}</small></div><span className={'activity-amount '+(threshold(p)>=.8?'warn':'')}>{valueText(p)} <ArrowUpRight size={14}/></span></div>}) : <div className="empty-list"><Cloud size={26}/><p>暂无额度记录，点击卡片添加数据</p></div>}
      </div><div className="side-panel"><div className="panel-title"><div><span className="section-kicker">快速操作</span><h3>常用操作</h3></div></div>
       <button className="quick-action" onClick={add}><span className="quick-icon red"><Plus size={22}/></span><span><strong>绑定 AI 平台账号</strong><small>新增订阅或 API 账户</small></span><ArrowRight size={18}/></button>
       <button className="quick-action" onClick={()=>switchSection('insights')}><span className="quick-icon blue"><TrendingUp size={21}/></span><span><strong>查看额度趋势</strong><small>监控使用量与预算占比</small></span><ArrowRight size={18}/></button>
       <div className="next-reset"><Clock3 size={17}/>{nextReset?'最近重置 · '+nextReset.name+' · '+nextReset.reset:'设置重置日期后，将在此显示提醒'}</div>
      </div></section>
    </>}
    {section==='providers' && <>
     <div className="page-title"><span className="section-kicker">平台与账号</span><h1>我的平台<span className="title-dot">.</span></h1><p>每一个额度，都清晰可见。已配置与未连接的平台会明确区分。</p></div>
     <div className="toolbar"><div className="tabs">{['全部','API','订阅','需关注'].map(x=><button key={x} className={category===x?'tab active':'tab'} onClick={()=>setCategory(x)}>{x}</button>)}</div><div className="toolbar-right"><label className="search"><Search size={17}/><input placeholder="搜索平台..." value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="primary-button smaller" onClick={add}><Plus size={18}/> 添加平台</button></div></div>
     <div className="card-grid all-grid">{filtered.map(p=><ProviderCard key={p.id} data={p} isDemo={demoMode} onEdit={edit} onRefresh={p=>void refreshOne(p)}/>)}<button className="add-card" onClick={add}><span><Plus size={27}/></span><strong>添加更多平台</strong><small>手动管理或连接官方 API</small></button></div>
     {!filtered.length && !!items.length && <div className="no-results"><Search size={28}/><p>没有匹配的平台，尝试更换筛选条件。</p></div>}
    </>}
    {section==='insights' && <>
     <div className="page-title"><span className="section-kicker">真实采样记录</span><h1>额度趋势</h1><p>每个账号分别保存时间戳与单位。折线展示实际额度，柱状图展示相邻采样间的变化。</p></div>
     <div className="insight-note"><Activity size={18}/><span>只展示实际读取的额度，90 秒尝试采样。网站变化或登录失效时保留历史，并明确标注异常。</span></div>
     <div className="history-grid">{viewing.map(p=><HistoryChart key={p.id} provider={p} revision={historyRevision}/>)}</div>
     {!viewing.length && <div className="empty-onboarding"><Activity size={25}/><div><strong>尚未生成额度趋势</strong><p>先绑定一个平台账号，连续采集后这里会自动形成折线图与柱状图。</p></div><button className="primary-button smaller" onClick={add}>绑定账号</button></div>}
    </>}
    {section==='settings' && <>
     <div className="page-title"><span className="section-kicker">外观与安全</span><h1>偏好设置<span className="title-dot">.</span></h1><p>本地优先、透明展示，不收集平台账号密码或聊天内容。</p></div>
     <div className="settings-layout"><section className="settings-card"><h3><ShieldCheck size={20}/> 本地数据与安全</h3><p>平台名称、额度、备注保存在当前应用的本地数据目录。桌面端 API 密钥通过 Windows 系统加密能力加密；网页端不提供密钥存储。</p><div className="setting-line"><div><strong>运行模式</strong><small>{isAndroid?'Android 原生应用':desktop?'Windows Electron 桌面端':'网页 / 可安装 PWA'}</small></div><span className="setting-tag">{desktop?'桌面端':'网页端'}</span></div><div className="setting-line"><div><strong>自动监测账号</strong><small>包含官方 API 连接与已登录的网页额度监测账号</small></div><span className="setting-tag">{connectedCount} 个连接</span></div><div className="setting-line"><div><strong>后台采样</strong><small>每 90 秒尝试读取已绑定的 API 和已打开的官方额度网页；关闭窗口或重新登录可能暂停网页采样</small></div><span className="setting-tag">{desktop?'运行中':'桌面端可用'}</span></div>
      <div className="identity-settings-card">
       <div><strong>身份与 Google 登录</strong><p>{googleIdentity?.profile?'已关联 '+googleIdentity.profile.email:'默认本地模式，可选用 Google 验证个人身份。不会读取邮箱或同步其他 AI 平台的登录会话。'}</p></div>
       <button onClick={()=>setIdentityOpen(true)}>{googleIdentity?.profile?'管理身份':'设置 Google 登录'}</button>
      </div></section>
     <section className="settings-card"><h3><Download size={20}/> 数据导出</h3><p>导出平台配置和已记录额度为 JSON，便于备份。文件中不包含 API 密钥，也不会自动上传到外部服务。</p><button className="outline-button" onClick={exportData}><Download size={18}/> 导出本地额度记录</button><div className="settings-divider"/><h3><CircleHelp size={20}/> 接入说明</h3><p>个人 ChatGPT 的订阅用量没有等同于 DeepSeek 余额的通用读取接口，因此采用手动记录与官方网页入口。OpenAI API 需要具有对应权限的组织 Admin Key。</p><button className="outline-button" onClick={()=>goTo('https://platform.deepseek.com/api_keys')}>DeepSeek 官方密钥管理 <ExternalLink size={16}/></button></section></div>
    </>}
   </main>
   <footer className="footer"><span><span className="footer-dot"/> AGNOVEXA ONE / v0.11.2</span><span>本地优先 · 安全管理</span></footer>
  </div>
  <IdentityPanel open={identityOpen} onClose={()=>setIdentityOpen(false)}/>
  {editor && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy)setEditor(null)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
   <div className="modal-header"><div><span className="section-kicker">账号管理</span><h2 id="modal-title">{editor.type==='new'?'绑定新的 AI 账号':'账号配置 · '+draft.name}</h2></div><button className="icon-button" onClick={()=>setEditor(null)} disabled={busy} title="关闭"><X size={21}/></button></div>
   <div className="modal-scroll">
    {editor.type==='new' && <label className="field"><span>平台类型</span><ReadableSelect ariaLabel="平台类型" value={draft.kind}
 options={[{value:'custom',label:'自定义平台'},...platformChoices.map(x=>({value:x.kind,label:x.name}))]}
 onChange={value=>selectKind(value as ProviderKind)} /></label>}
    <div className="modal-two"><label className="field"><span>平台名称</span><input value={draft.name} maxLength={60} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} placeholder="例如 DeepSeek"/></label><label className="field"><span>服务类型</span><ReadableSelect ariaLabel="服务类型" value={draft.category}
 options={[{value:'API',label:'API 服务'},{value:'订阅',label:'订阅服务'}]}
 onChange={value=>setDraft(p=>({...p,category:value as 'API'|'订阅'}))} /></label></div>
    <label className="field"><span>账号名称 / 别名</span><input value={draft.account} maxLength={80} onChange={e=>setDraft(p=>({...p,account:e.target.value}))} placeholder="例如 工作账号、个人账号（非密码）"/></label><div className="modal-two"><label className="field"><span>追踪指标</span><ReadableSelect ariaLabel="追踪指标" value={draft.metric}
 options={[{value:'balance',label:'剩余余额'},{value:'usage',label:'已使用额度'},{value:'spend',label:'本月消费'}]}
 onChange={value=>setDraft(p=>({...p,metric:value as Metric}))} /></label><label className="field"><span>单位</span><ReadableSelect ariaLabel="单位" value={draft.unit}
 options={[{value:'CNY',label:'人民币 CNY'},{value:'USD',label:'美元 USD'},{value:'次',label:'请求 / 次'},{value:'tokens',label:'Tokens'},{value:'积分',label:'积分'},{value:'%',label:'百分比 %'}]}
 onChange={value=>setDraft(p=>({...p,unit:value}))} /></label></div>
    <div className="modal-two"><label className="field"><span>{draft.metric==='balance'?'当前剩余余额':draft.metric==='spend'?'本月消费金额':'本周期已用额度'}</span><input type="number" min="0" step="any" placeholder="留空表示未知" value={draft.value} onChange={e=>setDraft(p=>({...p,value:e.target.value}))}/></label><label className="field"><span>参考上限 / 预算</span><input type="number" min="0" step="any" placeholder="可选" value={draft.limit} onChange={e=>setDraft(p=>({...p,limit:e.target.value}))}/></label></div>
    <div className="modal-two"><label className="field"><span>下次重置日期（可选）</span><input type="date" value={draft.reset} onChange={e=>setDraft(p=>({...p,reset:e.target.value}))}/></label><label className="field"><span>备注（可选）</span><input value={draft.note} maxLength={180} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} placeholder="例如 工作账号"/></label></div>
    {isLiveKind(draft.kind) && <div className="key-panel"><div className="key-panel-heading"><ShieldCheck size={18}/><strong>{draft.kind==='relay'?'中转站余额查询':'官方 API 实时同步'}</strong><span>{desktop?'已支持':'桌面端 / Android'}</span></div><p>{draft.kind==='deepseek'?'输入 DeepSeek API Key，读取官方账户余额。':draft.kind==='openrouter'?'输入 OpenRouter Management Key，读取已购买额度和使用量并计算剩余额度。':draft.kind==='relay'?'请填写中转站的访问令牌或 API Key，不要输入网站登录密码。':'输入具有组织费用读取权限的 OpenAI Admin API Key，读取本月 API 消费。'} 密钥只保存在本机加密文件中。</p>{draft.kind==='relay' && <div className="relay-fields">
      <label className="field"><span>中转站地址（仅支持 HTTPS）</span><input value={draft.relayUrl} placeholder="https://your-relay.example.com" onChange={e=>setDraft(p=>({...p,relayUrl:e.target.value}))}/></label>
      <div className="modal-two"><label className="field"><span>余额接口类型</span><ReadableSelect ariaLabel="余额接口类型" value={draft.relayMode}
 options={[{value:'newapi-account',label:'New API / One API 账户余额'},{value:'newapi-key',label:'New API 密钥自身额度'},{value:'custom',label:'自定义 JSON 余额接口'}]}
 onChange={value=>setDraft(p=>({...p,relayMode:value as Draft['relayMode']}))} /></label>
      {draft.relayMode==='newapi-account' ? <label className="field"><span>平台用户 ID（数字）</span><input value={draft.relayUserId} inputMode="numeric" placeholder="个人设置中的用户 ID" onChange={e=>setDraft(p=>({...p,relayUserId:e.target.value}))}/></label> :
       <label className="field"><span>余额单位</span><input value={draft.relayUnit} placeholder="额度点 / USD / CNY" onChange={e=>setDraft(p=>({...p,relayUnit:e.target.value}))}/></label>}
      </div>
      {draft.relayMode==='custom' && <div className="modal-two"><label className="field"><span>余额接口路径</span><input value={draft.relayPath} placeholder="/api/user/balance" onChange={e=>setDraft(p=>({...p,relayPath:e.target.value}))}/></label><label className="field"><span>JSON 余额字段</span><input value={draft.relayField} placeholder="data.balance" onChange={e=>setDraft(p=>({...p,relayField:e.target.value}))}/></label></div>}
      {draft.relayMode!=='newapi-key' && <div className="modal-two"><label className="field"><span>换算除数</span><input type="number" min="0.0001" step="any" value={draft.relayDivisor} onChange={e=>setDraft(p=>({...p,relayDivisor:e.target.value}))}/></label><label className="field"><span>返回额度单位</span><input value={draft.relayUnit} onChange={e=>setDraft(p=>({...p,relayUnit:e.target.value}))}/></label></div>}
      <p className="security-hint">账户模式使用面板访问令牌与用户 ID；密钥模式使用 API Key，两者不等价。额度点默认不换算成金额，若中转站确认换算率，可自行设置除数。</p>
     </div>}
     <label className="field"><span>API Key {items.find(x=>x.id===editor?.id)?.connected?'（已连接；留空保持原连接）':''}</span><input type="password" value={secret} disabled={!desktop} autoComplete="off" spellCheck={false} placeholder={desktop?'输入密钥，保存时验证连接':'网页版禁用密钥输入'} onChange={e=>setSecret(e.target.value)}/></label>{!desktop && <div className="security-hint">请使用 Windows 桌面端或 Android 安装版进行安全自动连接。网页端仍可保存手动额度。</div>}</div>}
    {!isLiveKind(draft.kind)&&!['chatgpt','deepseek'].includes(draft.kind) && <div className="manual-note"><ShieldCheck size={17}/><span>此平台未提供适用于本应用的公开额度 API。你可以在下方打开官方网页，自行登录并授权读取页面上可见的额度。无需输入密码、Cookie 或令牌到 Agnovexa One。</span></div>}
    {draft.kind!=='relay' && draft.kind!=='custom' && <section className="web-quota-panel">
     <h3><Cloud size={18}/> 官方网页额度监测 <span className="setting-tag">90 秒采样</span></h3>
     <p>{['chatgpt','deepseek'].includes(draft.kind)?
      '只需在官方页面登录一次。登录后自动识别可见额度、关联账号并记录历史；关闭后重启也会尝试恢复会话。无法读取时不会编造数字。':
      '在隔离浏览器登录平台官网后，可选择需要追踪的可见额度。登录会话保存在本机。'}</p>
     <div className="web-quota-actions">
      <button type="button" disabled={!desktop||webBusy} onClick={()=>void openWebUsage()}><ExternalLink size={16}/>打开官方额度页</button>
      {!['chatgpt','deepseek'].includes(draft.kind) &&
       <button type="button" disabled={!desktop||webBusy} onClick={()=>void readWebUsage()}><RefreshCcw size={16}/>读取页面额度</button>}
      {editor.type==='edit' && items.find(x=>x.id===editor.id)?.webMonitored &&
       <button type="button" disabled={webBusy} onClick={()=>void stopWebMonitor()}>停止监测并清除网页登录</button>}
     </div>
     {webStatus && <div className={'web-quota-status'+(webError?' error':'')} role="status">{webStatus}</div>}
     {!!webCandidates.length && <div className="web-quota-list" role="radiogroup" aria-label="选择监控指标">
      {webCandidates.map(item=><button type="button" role="radio" aria-checked={selectedWeb===item.signature}
       key={item.signature} className={selectedWeb===item.signature?'selected':''} onClick={()=>{
        setSelectedWeb(item.signature)
        setDraft(d=>({...d,metric:item.metric,unit:item.unit,value:String(item.value),limit:item.limit!=null?String(item.limit):''}))
       }}>
       <span>{item.label}</span><strong>{item.value} {item.unit}</strong>
      </button>)}
     </div>}
     {selectedWeb && <div className="web-quota-status">已选定指标。点击底部「保存配置」即启用网页自动监测，并写入第一条真实历史记录。</div>}
    </section>}
    {editor.type==='edit' && items.find(x=>x.id===editor.id)?.error && <div className="error-hint">最近连接问题：{items.find(x=>x.id===editor.id)?.error}</div>}
    <div className="modal-links">{definitions.find(x=>x.kind===draft.kind) && <button onClick={()=>goTo(definitions.find(x=>x.kind===draft.kind)!.url)}><ExternalLink size={15}/> 打开官方平台</button>}{editor.type==='edit' && items.find(x=>x.id===editor.id)?.connected && <button onClick={()=>void disconnect()}><Wifi size={15}/> 断开密钥连接</button>}{editor.type==='edit' && <button className="remove-link" onClick={remove}>移除平台</button>}</div>
   </div>
   <div className="modal-footer"><span><ShieldCheck size={16}/> 数据保存在本地</span><div><button className="modal-cancel" disabled={busy} onClick={()=>setEditor(null)}>取消</button><button className="primary-button smaller" disabled={busy} onClick={()=>void save()}>{busy?'正在验证...':secret?'验证并保存':'保存配置'} <Check size={17}/></button></div></div>
  </div></div>}
  {toast && <div role="status" className="toast"><span className="toast-icon"><Activity size={17}/></span>{toast}<button onClick={()=>setToast('')} aria-label="关闭提示"><X size={16}/></button></div>}
 </div>
}
export default App
