import { useMemo, useState } from 'react'
import { ArrowRight, Bot, Code2, ExternalLink, KeyRound, Search, Server, TerminalSquare, X } from 'lucide-react'
import { definitions } from './catalog'
import { agentCatalog, agentSearch, type AgentEntry } from './agentCatalog'
import type { ProviderKind } from './types'

type Props = {
 onClose:()=>void
 onProvider:(kind:ProviderKind)=>void
 onOfficial:(url:string)=>void
}

const groups=['全部','编程 Agent','桌面 Agent','IDE 插件','自动化平台'] as const

function AgentGlyph({entry}:{entry:AgentEntry}){
 if(entry.category==='IDE 插件')return <Code2 size={21}/>
 if(entry.category==='编程 Agent')return <TerminalSquare size={21}/>
 return <Bot size={21}/>
}

export default function PlatformLibrary({onClose,onProvider,onOfficial}:Props){
 const [tab,setTab]=useState<'agent'|'quota'>('agent')
 const [group,setGroup]=useState<string>('全部')
 const [query,setQuery]=useState('')
 const [selected,setSelected]=useState<string|null>('opencode')
 const term=query.trim().toLocaleLowerCase()
 const agents=useMemo(()=>agentCatalog.filter(a=>(group==='全部'||a.category===group)&&agentSearch(a,term)),[group,term])
 const providers=useMemo(()=>definitions.filter(d=>
  !term||[d.name,d.category,d.tagline,d.kind].join(' ').toLocaleLowerCase().includes(term)),[term])
 return <div className="library-shade" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
  <section className="platform-library" role="dialog" aria-modal="true" aria-labelledby="library-heading">
   <header className="library-header">
    <div><span className="section-kicker">连接中心</span><h2 id="library-heading">选择需要管理的平台</h2>
    <p>优先复用已授权额度，智能体工具关联实际消耗的模型服务。</p></div>
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
   {tab==='agent'&&<div className="library-groups" role="group" aria-label="智能体分类">
    {groups.map(c=><button key={c} className={group===c?'selected':''} onClick={()=>setGroup(c)}>{c}</button>)}
   </div>}
   <div className="library-scroll">
    {tab==='quota'? <div className="library-grid">
      {providers.map(d=><button key={d.kind} className="library-entry quota-entry" onClick={()=>onProvider(d.kind)}>
        <span className={'library-symbol hue-'+d.hue}><Server size={20}/></span>
        <span className="library-entry-copy"><strong>{d.name}</strong><small>{d.tagline}</small>
        <span className="library-micro">{d.category==='API'?'API 额度':'订阅用量'} · {d.mode==='live'?'支持授权读取':'按官方能力接入'}</span></span>
        <ArrowRight className="library-entry-arrow" size={16}/>
       </button>)}
      </div>:
      <div className="library-grid">
       {agents.map(a=><article key={a.id} className={'library-entry agent-entry '+(selected===a.id?'expanded':'')}>
        <button className="library-agent-main" onClick={()=>setSelected(selected===a.id?null:a.id)} aria-expanded={selected===a.id}>
         <span className="library-symbol"><AgentGlyph entry={a}/></span>
         <span className="library-entry-copy"><strong>{a.name}</strong><small>{a.vendor} · {a.category}</small>
          <span className="library-micro">{a.auth}</span></span>
         <ArrowRight className="library-entry-arrow" size={16}/>
        </button>
        {selected===a.id && <div className="library-agent-detail">
         <p>{a.summary}</p><p className="library-caution">{a.note}</p>
         <div className="library-agent-buttons">
          <button className="library-official" onClick={()=>onOfficial(a.url)}><ExternalLink size={14}/> 官方说明</button>
          {a.providerHints.slice(0,3).map(kind=>{
           const provider=definitions.find(d=>d.kind===kind)
           return provider?<button key={kind} className="library-api-link" onClick={()=>onProvider(kind)}
            title={'关联 '+provider.name+' 的实际 API 用量，而非 '+a.name+' 的独立订阅'}><KeyRound size={13}/> {provider.name}</button>:null
          })}
         </div>
        </div>}
       </article>)}
      </div>}
    {(tab==='agent'?agents.length:providers.length)===0&&<div className="library-empty"><Search size={23}/><p>没有找到匹配的平台。可尝试英文名、中文名或工具分类。</p></div>}
   </div>
   <footer className="library-footer"><span>API Key 仅在明确连接对应模型服务时输入；不会读取智能体本地密钥文件。</span><button onClick={onClose}>返回工作台</button></footer>
  </section>
 </div>
}
