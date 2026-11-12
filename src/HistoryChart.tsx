import { useEffect, useMemo, useState } from 'react'
import { BarChart3, LineChart, History } from 'lucide-react'
import type { Provider, QuotaHistoryPoint } from './types'

type View = 'line' | 'bar'
type Span = '24h' | '7d' | '30d' | 'all'
const periods: {id:Span,label:string,ms:number}[]=[
  {id:'24h',label:'24 小时',ms:24*3600000},
  {id:'7d',label:'7 天',ms:7*86400000},
  {id:'30d',label:'30 天',ms:30*86400000},
  {id:'all',label:'全部',ms:Infinity}
]
const fmt=(n:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(n)

export default function HistoryChart({provider,revision}:{provider:Provider;revision:number}) {
 const [points,setPoints]=useState<QuotaHistoryPoint[]>([])
 const [view,setView]=useState<View>('line')
 const [span,setSpan]=useState<Span>('7d')
 const [loaded,setLoaded]=useState(false)
 useEffect(()=>{
  let alive=true
  setLoaded(false)
  if(!window.quotaBridge?.history){setPoints([]);setLoaded(true);return}
  void window.quotaBridge.history(provider.id).then(data=>{
   if(alive){setPoints(Array.isArray(data)?data.filter(p=>Number.isFinite(p.value)):[]);setLoaded(true)}
  }).catch(()=>{if(alive){setPoints([]);setLoaded(true)}})
  return ()=>{alive=false}
 },[provider.id,revision])
 const entries=useMemo(()=>{
  const duration=periods.find(p=>p.id===span)!.ms
  const cutoff=Date.now()-duration
  return points.filter(p=>Date.parse(p.at)>=cutoff && p.metric===provider.metric && p.unit===provider.unit && (!provider.source || p.source===provider.source))
   .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-160)
 },[points,provider.metric,provider.unit,provider.source,span])
 const values=view==='line'?entries.map(p=>p.value):entries.slice(1).map((p,i)=>Math.max(0,provider.metric==='balance'?entries[i].value-p.value:p.value-entries[i].value))
 const low=values.length?Math.min(...values):0
 const high=values.length?Math.max(...values):1
 const margin=view==='line'?Math.max((high-low)*.12,Math.abs(high)*.015,0.02):0
 const min=view==='line'?low-margin:0
 const max=view==='line'?high+margin:Math.max(high,1)
 const spread=Math.max(.00001,max-min)
 const W=500,H=174,PAD=24,graphW=W-2*PAD,graphH=H-2*PAD
 const xy=(n:number,i:number,total:number):[number,number]=>[
  PAD+(total<=1?graphW/2:i*graphW/(total-1)),
  H-PAD-(n-min)/spread*graphH
 ]
 const data=values.map((n,i)=>xy(n,i,values.length))
 const line=data.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ')
 const mostRecent=entries.at(-1)
 const change=entries.length>1?entries.at(-1)!.value-entries[0].value:null
 return <article className="history-card">
   <div className="history-header">
     <div><strong>{provider.name}</strong><small>{provider.metric==='balance'?'账户余额':provider.metric==='spend'?'累计消费':'用量'} · {provider.unit} · {provider.source==='web'?'网页登录采集':provider.source==='api'?'官方 API':'本地记录'}</small></div>
     <div className="history-switch" role="group" aria-label={provider.name+' 图表类型'}>
       <button aria-label="折线图" title="折线图" className={view==='line'?'selected':''} onClick={()=>setView('line')}><LineChart size={17}/></button>
       <button aria-label="变化柱状图" title="变化柱状图" className={view==='bar'?'selected':''} onClick={()=>setView('bar')}><BarChart3 size={17}/></button>
     </div>
   </div>
   <div className="history-topline">
    <strong>{mostRecent?fmt(mostRecent.value):'--'} <small>{provider.unit}</small></strong>
    <small>{change!==null?'区间变化 '+(change>0?'+':'')+fmt(change):'尚无可比较的变化记录'}</small>
   </div>
   <div className="history-chart">
     {loaded && values.length>=(view==='line'?2:1) ?
       <svg viewBox={'0 0 '+W+' '+H} role="img" aria-label={provider.name+(view==='line'?'余额趋势':'每次采样间隔变化')+'，共'+values.length+'个数据点'}>
        {[0,1,2,3].map(i=><line key={i} x1={PAD} x2={W-PAD} y1={PAD+i*graphH/3} y2={PAD+i*graphH/3} stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5"/>)}
        {view==='line'?<><path d={line} fill="none" stroke="var(--ui-chart-line, #5da68e)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>
         {data.map(([x,y],i)=>i===0||i===data.length-1||i%Math.max(1,Math.ceil(data.length/14))===0
          ?<circle key={i} cx={x} cy={y} r="3" fill="var(--ui-chart-dot, #d9f0e5)" stroke="var(--ui-chart-dot-edge, #337a65)" strokeWidth="1.3">
            <title>{new Date(entries[i].at).toLocaleString('zh-CN')} · {fmt(entries[i].value)} {provider.unit}</title>
           </circle>:null)}</>:
         data.map(([x,y],i)=><rect key={i} x={x-Math.max(2,graphW/(values.length+5)*.4)} y={y} width={Math.max(4,Math.min(20,graphW/(values.length+5)*.8))} height={H-PAD-y} rx="2" fill="var(--ui-chart-line, #5da68e)" fillOpacity=".83">
          <title>{new Date(entries[i+1].at).toLocaleString('zh-CN')} · 区间变化 {fmt(values[i])} {provider.unit}</title>
         </rect>)}
        <text x={PAD} y={H-5} fontSize="10" fill="currentColor" opacity=".68">{entries[0] && new Date(entries[0].at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</text>
        <text x={W-PAD} y={H-5} fontSize="10" textAnchor="end" fill="currentColor" opacity=".68">{mostRecent && new Date(mostRecent.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</text>
       </svg> :
       <div className="history-unavailable"><History size={23}/><strong>{!loaded?'正在读取历史数据…':'等待真实数据变化'}</strong><span>至少需要两次成功采样才能形成趋势。不会生成虚构数据。</span></div>}
   </div>
   <div className="history-footer">
    <div className="history-periods">{periods.map(p=><button key={p.id} className={span===p.id?'selected':''} onClick={()=>setSpan(p.id)}>{p.label}</button>)}</div>
    <span>{mostRecent?'最后记录 '+new Date(mostRecent.at).toLocaleString('zh-CN'):'尚无采样'}</span>
   </div>
 </article>
}
