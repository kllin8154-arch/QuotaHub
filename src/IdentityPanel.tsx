import { useEffect, useState } from 'react'
import { Check, CircleHelp, ExternalLink, LoaderCircle, LockKeyhole, Settings2, ShieldCheck, X } from 'lucide-react'
import type { GoogleIdentityState } from './types'

const googleHelp='https://console.cloud.google.com/auth/clients'
const localState:GoogleIdentityState={configured:false,clientSecretConfigured:false,secureStorage:false,busy:false,profile:null}
function readableOAuthError(e:unknown){
 const raw=e instanceof Error?e.message:String(e)
 return raw.replace(/^Error invoking remote method ['\"][^'\"]+['\"]:\s*(?:Error:\s*)?/,'')
   .replace(/^Error:\s*/,'')
}
function showLink(url:string){
 if(window.quotaBridge?.openExternal)void window.quotaBridge.openExternal(url)
 else window.open(url,'_blank','noopener,noreferrer')
}
export default function IdentityPanel({open,onClose}:{open:boolean;onClose:()=>void}){
 const [state,setState]=useState<GoogleIdentityState>(localState)
 const [busy,setBusy]=useState(false)
 const [clientId,setClientId]=useState('')
 const [showSetup,setShowSetup]=useState(false)
 const [error,setError]=useState('')
 const isDesktop=Boolean(window.quotaBridge?.identityStatus)
 useEffect(()=>{
  if(!open||!isDesktop)return
  let mounted=true
  void window.quotaBridge!.identityStatus!().then(status=>{if(mounted)setState(status)})
    .catch(e=>{if(mounted)setError(String(e))})
  const unsubscribe=window.quotaBridge?.onIdentity?.(value=>{if(mounted)setState(value)})
  return ()=>{mounted=false;unsubscribe?.()}
 },[open,isDesktop])
 if(!open)return null
 async function login(){
  if(!window.quotaBridge?.googleSignIn)return
  setBusy(true);setError('')
  try{
   const result=await window.quotaBridge.googleSignIn()
   setState(result)
  }catch(e){setError(readableOAuthError(e))}
  finally{setBusy(false)}
 }
 async function importJSON(){
  if(!window.quotaBridge?.googleImportOAuthJson)return
  setBusy(true);setError('')
  try{
   const result=await window.quotaBridge.googleImportOAuthJson()
   setState(result);setClientId('');setShowSetup(false)
  }catch(e){setError(readableOAuthError(e))}
  finally{setBusy(false)}
 }
 async function setup(){
  if(!window.quotaBridge?.googleConfigure)return
  setBusy(true);setError('')
  try{
   const result=await window.quotaBridge.googleConfigure(clientId.trim())
   setState(result);setClientId('');setShowSetup(false)
  }catch(e){setError(readableOAuthError(e))}
  finally{setBusy(false)}
 }
 async function signOut(){
  if(!window.quotaBridge?.googleSignOut)return
  setBusy(true);setError('')
  try{setState(await window.quotaBridge.googleSignOut())}
  catch(e){setError(readableOAuthError(e))}
  finally{setBusy(false)}
 }
 return <div className="identity-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
   <section className="identity-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-heading">
    <header className="identity-head">
     <div><span>账户管理</span><h2 id="identity-heading">身份与登录</h2></div>
     <button className="identity-icon-button" aria-label="关闭账户面板" onClick={onClose} disabled={busy}><X size={19}/></button>
    </header>
    <div className="identity-body">
     <div className="identity-local">
      <div className="identity-local-icon"><ShieldCheck size={20}/></div>
      <div><strong>本地模式始终可用</strong><p>无需注册；已绑定的 AI 平台、额度和浏览器会话继续保存在此电脑。</p></div>
      <Check size={17} className="identity-check"/>
     </div>
     {state.profile ? <div className="identity-profile">
      <div className="identity-profile-top"><img src="./google-mark.svg" alt="" width="28" height="28"/><span>Google 身份已关联到此设备</span></div>
      <h3>{state.profile.name}</h3>
      <p className="identity-email">{state.profile.email}</p>
      <div className="identity-verified"><ShieldCheck size={15}/> 由 Google 验证 · 身份信息本机加密保存</div>
      <div className="identity-actions">
       <button className="identity-outline-button" disabled={busy} onClick={()=>void login()}>重新验证</button>
       <button className="identity-text-button" disabled={busy} onClick={()=>void signOut()}>解除本地关联</button>
      </div>
     </div> : <div className="identity-login-section">
       <div className="identity-subhead"><strong>使用 Google 登录</strong><p>快速确认个人身份，不会自动获得其他 AI 平台的授权或额度。</p></div>
       <button className="identity-google-button" disabled={!isDesktop||!state.configured||!state.secureStorage||busy} onClick={()=>void login()}>
        {busy?<LoaderCircle size={19} className="identity-spin"/>:<img src="./google-mark.svg" alt="" width="20" height="20"/>}
        {busy?'正在验证 Google 登录…':state.configured?'使用 Google 账号继续':'Google OAuth 尚未配置'}
       </button>
       {!isDesktop && <p className="identity-help">Google 身份绑定目前仅在 Windows 桌面版启用；网页和 Android 仍可继续使用本地模式。</p>}
       {isDesktop&&!state.secureStorage && <p className="identity-help">此设备无法使用系统加密存储，因此暂时禁用 Google 登录。</p>}
       {isDesktop&&!state.configured&&<p className="identity-help">需要项目所有者首次配置 Google Cloud 的桌面 OAuth Client ID。完成后，普通用户只需点击登录。</p>}
      </div>}
     {isDesktop && <div className="identity-setup">
      <button className="identity-setup-trigger" onClick={()=>setShowSetup(!showSetup)} aria-expanded={showSetup}>
       <Settings2 size={16}/> 应用 OAuth 配置 <span>{showSetup?'收起':'展开'}</span>
      </button>
      {showSetup&&<div className="identity-setup-content">
       <p>仅由应用发布者配置一次。推荐导入 Google Cloud 下载的 <strong>Desktop app OAuth JSON</strong>，程序只在此设备加密保存客户端信息，原文件不会上传或复制到发布包。</p>
       <button className="identity-google-button" disabled={busy||!state.secureStorage} onClick={()=>void importJSON()}>
        从本机导入 Google OAuth JSON
       </button>
       <p>{state.clientSecretConfigured?'客户端配置已加密保存，可完成 Google 令牌兑换':'当前只配置了 Client ID；部分 Google 桌面客户端要求同时提供 client_secret。'}</p>
       <label htmlFor="google-client-id">Google OAuth Client ID</label>
       <input id="google-client-id" spellCheck={false} autoComplete="off" placeholder="xxxxxxxx-xxxxx.apps.googleusercontent.com"
        value={clientId} onChange={e=>setClientId(e.target.value)} />
       <div className="identity-setup-actions">
        <button className="identity-outline-button" onClick={()=>showLink(googleHelp)}><ExternalLink size={14}/> 打开 Google Cloud</button>
        <button className="identity-save-button" disabled={busy||!clientId.trim()} onClick={()=>void setup()}>保存本机配置</button>
       </div>
      </div>}
     </div>}
     {error&&<div className="identity-error" role="alert">{error}</div>}
     <div className="identity-disclaimer"><LockKeyhole size={17}/><p>不会保存 Google 访问令牌、读取 Gmail 或上传其他平台的会话。Google 身份登录不代表 ChatGPT、DeepSeek 等账号已授权。当前不提供跨设备云同步。</p></div>
    </div>
    <footer className="identity-foot">
     <button className="identity-local-button" onClick={onClose} disabled={busy}><CircleHelp size={16}/> {state.profile?'返回看板':'继续本地使用'}</button>
    </footer>
   </section>
  </div>
}
