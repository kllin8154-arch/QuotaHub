import type { ProviderKind } from './types'

export const serviceTypeOptions = [
 {value:'api',label:'API 服务'},
 {value:'subscription',label:'订阅产品'},
 {value:'hybrid',label:'API + 订阅'},
 {value:'gateway',label:'模型网关 / 中转'},
 {value:'agent',label:'AI 智能体 / IDE'},
 {value:'local',label:'本地模型 / 自建'},
 {value:'other',label:'其他服务'}
] as const
export type ServiceType=typeof serviceTypeOptions[number]['value']
const valid=new Set<string>(serviceTypeOptions.map(x=>x.value))
export const isServiceType=(x:unknown):x is ServiceType=>typeof x==='string'&&valid.has(x)
export function defaultServiceType(kind:ProviderKind,category:'API'|'订阅'):ServiceType {
 if(kind==='relay')return 'gateway'
 if(kind==='custom')return 'other'
 return category==='订阅'?'subscription':'api'
}
export const serviceTypeLabel=(type:ServiceType)=>serviceTypeOptions.find(x=>x.value===type)?.label||'其他服务'
