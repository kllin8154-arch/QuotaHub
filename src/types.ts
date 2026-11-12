import type { ServiceType } from './serviceTypes'
export type GoogleIdentityState = {configured:boolean;clientSecretConfigured?:boolean;secureStorage:boolean;busy:boolean;
  profile:{provider:'google';name:string;email:string;emailVerified:true;linkedAt:string;persisted:boolean}|null}
export type PlatformLinksStatus = {verified:boolean;linked:string[];unlinked:string[];linkedCount:number;availableCount:number;conflictCount:number}
export type ProviderKind = 'deepseek' | 'openai-api' | 'openrouter' | 'chatgpt' | 'claude' | 'gemini' | 'siliconflow' | 'qwen' | 'kimi' | 'zhipu' | 'cursor' | 'custom' | 'relay'
export type Metric = 'balance' | 'usage' | 'spend'
export type RelayConfig = { baseUrl: string; mode: 'newapi-account' | 'newapi-key' | 'custom'; userId?: string; path?: string; field?: string; unit?: string; divisor?: number }
export type QuotaHistoryPoint = { at:string; value:number; metric:Metric; unit:string; source:'api'|'web'|'manual'; limit?:number|null }
export type WebQuotaCandidate = { label:string; signature:string; value:number; limit:number|null; metric:Metric; unit:string }
export type QuotaWindow={id:'five-hour'|'weekly';label:string;remainingPercent:number|null;resetAt:string|null;resetBasis:'explicit'|'countdown'|null;resetPrecision:'minute'|'date'|null;observedAt:string}
export type QuotaWindowInfo={quotaWindows?:QuotaWindow[];planTier?:string|null;planObservedAt?:string}
export type QuotaReset = {resetAt:string|null;resetBasis:'explicit'|'countdown'|null;resetPrecision:'date'|'minute'|null;resetObservedAt:string}
export type SnapshotMessage = {type:'linked';point:{id:string;kind:ProviderKind;value:number;unit:string;metric:Metric;limit:number|null;at:string;source:'web'} & Partial<QuotaReset> & QuotaWindowInfo;provider:{id:string;kind:ProviderKind;name:string;category:'API'|'订阅';metric:Metric;unit:string;value:number;source:'web';webMonitored:boolean;connected:boolean;updatedAt:string} & Partial<QuotaReset> & QuotaWindowInfo} | {type:'snapshot';point:{id:string;kind:ProviderKind;value:number;unit:string;metric:Metric;limit:number|null;at:string;source:'api'|'web'} & Partial<QuotaReset> & QuotaWindowInfo } | {type:'stale';id:string;reason:string}
export type Provider = QuotaWindowInfo & { serviceType?:ServiceType; resetAt?:string|null;resetBasis?:QuotaReset['resetBasis'];resetPrecision?:QuotaReset['resetPrecision'];resetObservedAt?:string; webMonitored?:boolean;source?:'api'|'web'|'manual'; id:string; kind:ProviderKind; name:string; account?:string; category:'API' | '订阅'; mode:'live' | 'manual'; metric:Metric; value:number|null; limit:number|null; unit:string; note?:string; reset?:string; updatedAt?:string; connected?:boolean; error?:string; alertEnabled?:boolean; alertPercent?:number; daily?:number[]; bonus?:number; relay?:RelayConfig }
export type LiveResult = { value:number; unit:string; metric:Metric; daily?:number[]; bonus?:number; updatedAt:string }
export type Bridge = { connect:(kind:'deepseek'|'openai-api'|'openrouter'|'relay', id:string, key:string, relay?:RelayConfig)=>Promise<LiveResult>; refresh:(kind:'deepseek'|'openai-api'|'openrouter'|'relay',id:string)=>Promise<LiveResult>; disconnect:(kind:'deepseek'|'openai-api'|'openrouter'|'relay',id:string)=>Promise<boolean>; connected:()=>Promise<string[]>; openExternal:(url:string)=>Promise<void>; updateWidgetAccounts?:(accounts:{id:string;name:string;account?:string;kind:string;value:number|null;unit:string;metric:string;updatedAt?:string;connected?:boolean;error?:string;resetAt?:string|null;resetBasis?:QuotaReset['resetBasis'];resetPrecision?:QuotaReset['resetPrecision'];resetObservedAt?:string;quotaWindows?:QuotaWindow[];planTier?:string|null;planObservedAt?:string}[])=>Promise<boolean>; widgetAccounts?:()=>Promise<unknown[]>;
 webOpen?:(kind:ProviderKind,id:string)=>Promise<{url:string}>;
 webRead?:(kind:ProviderKind,id:string)=>Promise<{candidates:WebQuotaCandidate[];readAt:string;url:string;reset?:Partial<QuotaReset>|null;windows?:QuotaWindow[];planTier?:string|null}>;
 webBind?:(kind:ProviderKind,id:string,choice:WebQuotaCandidate)=>Promise<{id:string;kind:ProviderKind;value:number;limit:number|null;unit:string;metric:Metric;at:string;source:'web'} & Partial<QuotaReset> & QuotaWindowInfo>;
 webSample?:(kind:ProviderKind,id:string)=>Promise<{id:string;value:number;unit:string;metric:Metric;at:string;source:'web'} & Partial<QuotaReset> & QuotaWindowInfo>;
 webUnbind?:(id:string)=>Promise<boolean>;
 webBindings?:()=>Promise<Record<string,{kind:ProviderKind;signature:string;metric:Metric;unit:string;name?:string;resetAt?:string|null;resetBasis?:QuotaReset['resetBasis'];resetPrecision?:QuotaReset['resetPrecision'];resetObservedAt?:string;quotaWindows?:QuotaWindow[];planTier?:string|null;planObservedAt?:string;last?:{value:number;at:string;unit:string;metric:Metric}|null}>>;
 history?:(id:string)=>Promise<QuotaHistoryPoint[]>;
 historyRecord?:(point:{id:string;value:number;metric:Metric;unit:string;source:'manual'|'api';limit?:number|null})=>Promise<boolean>;
 identityStatus?:()=>Promise<GoogleIdentityState>;
 platformLinks?:()=>Promise<PlatformLinksStatus>;
 linkExistingAccounts?:(ids:string[])=>Promise<PlatformLinksStatus>;
 unlinkExistingAccounts?:(ids:string[])=>Promise<PlatformLinksStatus>;
 googleConfigure?:(clientId:string)=>Promise<GoogleIdentityState>;
 googleImportOAuthJson?:()=>Promise<GoogleIdentityState>;
 googleSignIn?:()=>Promise<GoogleIdentityState>;
 googleSignOut?:()=>Promise<GoogleIdentityState>;
 googleCancel?:()=>Promise<boolean>;
 onIdentity?:(callback:(status:GoogleIdentityState)=>void)=>(()=>void);
 onDetailRequested?:(callback:(id:string)=>void)=>(()=>void);
 onSnapshot?:(callback:(message:SnapshotMessage)=>void)=>(()=>void);
 }
declare global { interface Window { quotaBridge?: Bridge } }
