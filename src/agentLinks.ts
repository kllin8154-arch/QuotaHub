import type { ProviderKind } from './types'
import { agentCatalog } from './agentCatalog'
const KEY='aiquotahub.agentLinks.v1'
const allowedAgentIds=new Set(agentCatalog.map(a=>a.id))
const kinds=new Set<ProviderKind>(['deepseek','openai-api','openrouter','chatgpt','claude','gemini','siliconflow','qwen','kimi','zhipu','cursor','custom','relay'])
export type AgentProviderLink={providerId:string;kind:ProviderKind}
export type AgentLinks=Record<string,AgentProviderLink>
export function readAgentLinks():AgentLinks{
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)||'{}') as unknown
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
  const output:AgentLinks={}
  for(const [id,value] of Object.entries(raw)){
   if(!allowedAgentIds.has(id)||!value||typeof value!=='object'||Array.isArray(value))continue
   const x=value as Partial<AgentProviderLink>
   if(typeof x.providerId!=='string'||!/^[-\w]{2,110}$/.test(x.providerId)||!kinds.has(x.kind as ProviderKind))continue
   output[id]={providerId:x.providerId,kind:x.kind as ProviderKind}
  }
  return output
 }catch{return {}}
}
export function writeAgentLinks(links:AgentLinks):void{
 const cleaned:Object=Object.fromEntries(Object.entries(links)
  .filter(([id,link])=>allowedAgentIds.has(id)&&/^[-\w]{2,110}$/.test(link.providerId)&&kinds.has(link.kind)))
 try{localStorage.setItem(KEY,JSON.stringify(cleaned))}catch{/* Keep UI usable when storage is blocked. */}
}
