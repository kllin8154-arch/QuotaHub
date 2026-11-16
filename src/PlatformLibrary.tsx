import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bot, Check, ChevronRight, Code2, ExternalLink, KeyRound, RefreshCcw, Search, Server, TerminalSquare, X } from 'lucide-react'
import { definitions } from './catalog'
import { agentCatalog, agentSearch, type AgentEntry } from './agentCatalog'
import { readAgentLinks, writeAgentLinks } from './agentLinks'
import type { DetectedAgent, ProviderKind } from './types'

type KnownProvider={id:string;kind:ProviderKind;name:string;account?:string;category:'API'|'订阅'}
type Props={
 onClose:()=>void
 onProvider:(kind:ProviderKind)=>void
 onOfficial:(url:string)=>void
 knownProviders:KnownProvider[]
}
const groups=['全部','本机发现','编程 Agent','桌面 Agent','IDE 插件','自动化平台'] as const
const allowedIds=new Set(agentCatalog.map(a=>a.id))
function AgentGlyph({entry}:{entry:AgentEntry}){
 if(entry.category==='IDE 插件')return <Code2 size={21}/>
 if(entry.category==='编程 Agent')return <TerminalSquare size={21}/>
 return <Bot size={21}/>
}
export default function PlatformLibrary({onClose,onProvider,onOfficial,knownProviders}:Props){
 const [tab,setTab]=useState<'agent'|'quota'>('agent')
 const [group,setGroup]=useState<string>('全部')
 const [query,setQuery]=useState('')
 const [selected,setSelected]=useState<string|null>('opencode')
 const [discovered,setDiscovered]=useState<DetectedAgent[]>([])
 const [scanState,setScanState]=useState<'scanning'|'ready'|'unavailable'>('scanning')
 const [links,setLinks]=useState(readAgentLinks)
 const [pending,setPending]=useState<{agentId:string;providerId:string}|null>(null)
 const scan=useCallback(async()=>{
  if(!window.quotaBridge?.discoverAgents){setScanState('unavailable');return}
  setScanState('scanning')
  try{
   const data=await window.quotaBridge.discoverAgents()
   setDiscovered(Array.isArray(data)?data.filter(d=>allowedIds.has(d.id)&&['config','app'].includes(d.evidence)).slice(0,16):[])
   setScanState('ready')
  }catch{setDiscovered([]);setScanState('unavailable')}
 },[])
 useEffect(()=>{void scan()},[scan])
 const discoveredMap=useMemo(()=>new Map(discovered.map(d=>[d.id,d.evidence])),[discovered])
 const term=query.trim().toLocaleLowerCase()
 const agents=useMemo(()=>agentCatalog
  .filter(a=>(group==='全部'||group==='本机发现'&&discoveredMap.has(a.id)||a.category===group)&&agentSearch(a,term))
  .sort((a,b)=>Number(discoveredMap.has(b.id))-Number(discoveredMap.has(a.id))),[group,term,discoveredMap])
 const providers=useMemo(()=>definitions.filter(d=>
  !term||[d.name,d.category,d.tagline,d.kind].join(' ').toLocaleLowerCase().includes(term)),[term])
 function applyLink(agentId:string,providerId:string){
  const p=knownProviders.find(x=>x.id===providerId)
  if(!p||!allowedIds.has(agentId))return
  const next={...links,[agentId]:{providerId:p.id,kind:p.kind}}
  setLinks(next);writeAgentLinks(next);setPending(null)
 }
 function unlink(agentId:string){
  const next={...links}
  delete next[agentId];setLinks(next);writeAgentLinks(next);setPending(null)
 }
 return <div className="library-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
  <section className="platform-library" role="dialog" aria-modal="true" aria-labelledby="library-heading">
   <header className="library-header">
    <div><span className="section-kicker">连接中心</span><h2 id="library-heading">选择需要管理的平台</h2>
    <p>自动发现本机工具；额度仍来自你明确授权的模型供应商。</p></div>
    <button className="icon-button" title="关闭平台列表" aria-label="关闭平台列表" onClick={onClose}><X size={20}/></button>
   </header>
   <div className="library-toolbar">
    <div className="library-tabs" role="tablist" aria-label="平台类型">
     <button role="tab" aria-selected={tab==='agent'} className={tab==='agent'?'selected':''} onClick={()=>setTab('agent')}>智能体工具 <span>{agentCatalog.length}</span></button>
     <button role="tab" aria-selected={tab==='quota'} className={tab==='quota'?'selected':''} onClick={()=>setTab('quota')}>额度服务 <span>{definitions.length}</span></button>
    </div>
    <label className="library-search"><Search size={17}/><input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)}
     placeholder={tab==='agent'?'搜索 OpenCode、WorkBuddy、Cline…':'搜索 DeepSeek、OpenRouter、API…'} aria-label="搜索平台目录"/></label>
   </div>
   {tab==='agent'&&<div className="agent-discovery-bar" role="status">
     <span className={'agent-discovery-dot '+(scanState==='ready'?'is-ready':'')}/>
     <span>{scanState==='scanning'?'正在检查本机工具…':scanState==='unavailable'?'仅桌面版支持本机发现':`发现 ${discovered.length} 个本机工具或配置`}</span>
     <button type="button" disabled={scanState==='scanning'} onClick={()=>void scan()}><RefreshCcw size={15}/>重新检测</button>
    </div>}
   {tab==='agent'&&<div className="library-groups" role="group" aria-label="智能体分类">
    {groups.map(g=><button key={g} className={group===g?'selected':''} onClick={()=>setGroup(g)}>
      {g}{g==='本机发现'&&<span className="discovered-count">{discovered.length}</span>}
    </button>)}
   </div>}
   <div className="library-scroll">
    {tab==='quota'?<div className="library-grid">
      {providers.map(d=><button key={d.kind} className="library-entry quota-entry" onClick={()=>onProvider(d.kind)}>
       <span className={'library-symbol hue-'+d.hue}><Server size={20}/></span>
       <span className="library-entry-copy"><strong>{d.name}</strong><small>{d.tagline}</small>
       <span className="library-micro">{d.category==='API'?'API 额度':'订阅用量'} · {d.mode==='live'?'支持授权读取':'按官方能力接入'}</span></span>
       <ArrowRight className="library-entry-arrow" size={16}/>
      </button>)}
     </div>:
     <div className="library-grid">
      {agents.map(a=>{
       const evidence=discoveredMap.get(a.id)
       const stored=links[a.id]
       const linked=stored?knownProviders.find(p=>p.id===stored.providerId&&p.kind===stored.kind):undefined
       const candidate=pending?.agentId===a.id?knownProviders.find(p=>p.id===pending.providerId):undefined
       return <article key={a.id} className={'library-entry agent-entry '+(selected===a.id?'expanded':'')}>
        <button className="library-agent-main" onClick={()=>{setSelected(selected===a.id?null:a.id);setPending(null)}} aria-expanded={selected===a.id}>
         <span className="library-symbol"><AgentGlyph entry={a}/></span>
         <span className="library-entry-copy"><strong>{a.name}{evidence&&<span className="agent-detected-badge">{evidence==='app'?'本机应用':'本机配置'}</span>}</strong>
          <small>{a.vendor} · {a.category}</small><span className="library-micro">{a.auth}</span></span>
         <ChevronRight className="library-entry-arrow" size={16}/>
        </button>
        {selected===a.id&&<div className="library-agent-detail">
         <p>{a.summary}</p><p className="library-caution">{a.note}</p>
         <div className="agent-link-surface">
          <div className="agent-link-title"><strong>实际额度来源</strong>
           <span>{linked?'已关联':stored?'待重新授权':evidence?'待确认':'可手动关联'}</span>
          </div>
          {linked?<div className="agent-linked-account"><Check size={16}/>
           <span>{linked.name}{linked.account?' · '+linked.account:''}<small>{linked.category==='订阅'?'订阅账号':'API 账户'} · 只共享额度显示关系，不共享凭据</small></span>
           <button type="button" onClick={()=>unlink(a.id)}>解除关联</button>
          </div>:stored?<p className="agent-link-hint">原关联账号目前未授权或已经移除，暂不显示对应额度。</p>:null}
          {knownProviders.length?<div className="agent-account-choices">
           {knownProviders.map(p=><button type="button" key={p.id}
            className={pending?.agentId===a.id&&pending?.providerId===p.id?'selected':''}
            onClick={()=>setPending({agentId:a.id,providerId:p.id})}>
            <span>{p.name}{p.account?' · '+p.account:''}</span><small>{p.category}</small>
           </button>)}
          </div>:<p className="agent-link-hint">没有可复用的已授权额度账号。请在下方选择实际使用的供应商。</p>}
          {candidate&&<div className="agent-link-confirm" role="group" aria-label="确认关联真实额度账号">
           <p>将 {a.name} 关联至 <strong>{candidate.name}</strong> 的现有额度。仅保存本地显示关系，不改变实际计费或登录授权。</p>
           <div><button type="button" onClick={()=>setPending(null)}>取消</button>
           <button type="button" className="agent-confirm-button" onClick={()=>applyLink(a.id,candidate.id)}><Check size={14}/>确认关联</button></div>
          </div>}
         </div>
         <div className="library-agent-buttons">
          <button className="library-official" onClick={()=>onOfficial(a.url)}><ExternalLink size={14}/> 官方说明</button>
          {a.providerHints.slice(0,3).map(kind=>{
           const provider=definitions.find(d=>d.kind===kind)
           return provider?<button key={kind} className="library-api-link" onClick={()=>onProvider(kind)}
            title={'连接 '+provider.name+' 的实际额度（需要相应账号授权）'}><KeyRound size={13}/>{provider.name}</button>:null
          })}
         </div>
        </div>}
       </article>
      })}
     </div>}
    {(tab==='agent'?agents.length:providers.length)===0&&<div className="library-empty"><Search size={23}/><p>{group==='本机发现'?'当前未找到匹配的本机工具，可切换“全部”查看支持列表。':'没有匹配的平台，请尝试名称或类别搜索。'}</p></div>}
   </div>
   <footer className="library-footer"><span>本机检测仅检查固定路径是否存在；不读取配置内容和密钥。关联额度需由你确认。</span><button onClick={onClose}>返回工作台</button></footer>
  </section>
 </div>
}
