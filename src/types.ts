export type ProviderKind = 'deepseek' | 'openai-api' | 'openrouter' | 'chatgpt' | 'claude' | 'gemini' | 'siliconflow' | 'qwen' | 'kimi' | 'zhipu' | 'cursor' | 'custom' | 'relay'
export type Metric = 'balance' | 'usage' | 'spend'
export type RelayConfig = { baseUrl: string; mode: 'newapi-account' | 'newapi-key' | 'custom'; userId?: string; path?: string; field?: string; unit?: string; divisor?: number }
export type QuotaHistoryPoint = { at:string; value:number; metric:Metric; unit:string; source:'api'|'web'|'manual'; limit?:number|null }
export type WebQuotaCandidate = { label:string; signature:string; value:number; limit:number|null; metric:Metric; unit:string }
export type SnapshotMessage = {type:'linked';point:{id:string;kind:ProviderKind;value:number;unit:string;metric:Metric;limit:number|null;at:string;source:'web'};provider:{id:string;kind:ProviderKind;name:string;category:'API'|'订阅';metric:Metric;unit:string;value:number;source:'web';webMonitored:boolean;connected:boolean;updatedAt:string}} | {type:'snapshot';point:{id:string;kind:ProviderKind;value:number;unit:string;metric:Metric;limit:number|null;at:string;source:'api'|'web'} } | {type:'stale';id:string;reason:string}
export type Provider = { webMonitored?:boolean;source?:'api'|'web'|'manual'; id:string; kind:ProviderKind; name:string; account?:string; category:'API' | '订阅'; mode:'live' | 'manual'; metric:Metric; value:number|null; limit:number|null; unit:string; note?:string; reset?:string; updatedAt?:string; connected?:boolean; error?:string; daily?:number[]; bonus?:number; relay?:RelayConfig }
export type LiveResult = { value:number; unit:string; metric:Metric; daily?:number[]; bonus?:number; updatedAt:string }
export type Bridge = { connect:(kind:'deepseek'|'openai-api'|'openrouter'|'relay', id:string, key:string, relay?:RelayConfig)=>Promise<LiveResult>; refresh:(kind:'deepseek'|'openai-api'|'openrouter'|'relay',id:string)=>Promise<LiveResult>; disconnect:(kind:'deepseek'|'openai-api'|'openrouter'|'relay',id:string)=>Promise<boolean>; connected:()=>Promise<string[]>; openExternal:(url:string)=>Promise<void>; updateWidgetAccounts?:(accounts:{id:string;name:string;account?:string;kind:string;value:number|null;unit:string;metric:string;updatedAt?:string;connected?:boolean}[])=>Promise<boolean>; widgetAccounts?:()=>Promise<unknown[]>;
 webOpen?:(kind:ProviderKind,id:string)=>Promise<{url:string}>;
 webRead?:(kind:ProviderKind,id:string)=>Promise<{candidates:WebQuotaCandidate[];readAt:string;url:string}>;
 webBind?:(kind:ProviderKind,id:string,choice:WebQuotaCandidate)=>Promise<{id:string;kind:ProviderKind;value:number;limit:number|null;unit:string;metric:Metric;at:string;source:'web'}>;
 webSample?:(kind:ProviderKind,id:string)=>Promise<{id:string;value:number;unit:string;metric:Metric;at:string;source:'web'}>;
 webUnbind?:(id:string)=>Promise<boolean>;
 webBindings?:()=>Promise<Record<string,{kind:ProviderKind;signature:string;metric:Metric;unit:string;name?:string;last?:{value:number;at:string;unit:string;metric:Metric}|null}>>;
 history?:(id:string)=>Promise<QuotaHistoryPoint[]>;
 historyRecord?:(point:{id:string;value:number;metric:Metric;unit:string;source:'manual'|'api';limit?:number|null})=>Promise<boolean>;
 onSnapshot?:(callback:(message:SnapshotMessage)=>void)=>(()=>void);
 }
declare global { interface Window { quotaBridge?: Bridge } }
