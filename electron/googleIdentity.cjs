'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');

const SCOPES='openid email profile';
const CLIENT_PATTERN=/^[0-9]{5,}-[a-z0-9_-]{12,}\.apps\.googleusercontent\.com$/i;
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO='https://openidconnect.googleapis.com/v1/userinfo';
const MAX_WAIT_MS=180000;
function validClientId(id){return typeof id==='string'&&id.length<=256&&CLIENT_PATTERN.test(id.trim())}
function randomBase64Url(size=32){return crypto.randomBytes(size).toString('base64url')}
function challengeFor(verifier){return crypto.createHash('sha256').update(verifier,'ascii').digest('base64url')}
function fixedEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function safeJSON(str){try{return JSON.parse(str)}catch{return null}}
function createGoogleIdentity(options){
 const {dataDir,safeStorage,shell,onChange,fetchImpl=fetch,serverFactory=http.createServer,
        now=()=>new Date().toISOString(),timeoutMs=MAX_WAIT_MS}=options;
 if(!dataDir||!safeStorage||!shell)throw Error('Missing Google identity dependencies');
 const configPath=path.join(dataDir,'google-oauth-client.json');
 const identityPath=path.join(dataDir,'google-identity.enc');
 let identity=null,pending=null;
 function isStorageReady(){return Boolean(safeStorage.isEncryptionAvailable())}
 function getConfig(){
  const file=safeJSON(fs.existsSync(configPath)?fs.readFileSync(configPath,'utf8'):'')||{};
  const env=process.env.QUOTAHUB_GOOGLE_CLIENT_ID?.trim();
  const id=validClientId(env)?env:validClientId(file.clientId)?file.clientId.trim():null;
  let secret=null;
  if(id && file.clientId===id && typeof file.clientSecretCiphertext==='string' &&
     file.clientSecretCiphertext.length<8192 && isStorageReady()){
   try{
    secret=safeStorage.decryptString(Buffer.from(file.clientSecretCiphertext,'base64'));
    if(typeof secret!=='string'||secret.length<4||secret.length>1024)secret=null;
   }catch{secret=null}
  }
  return {clientId:id,clientSecret:secret};
 }
 function getClientId(){return getConfig().clientId}
 function load(){
  if(!isStorageReady()||!fs.existsSync(identityPath))return;
  try{
   const b=fs.readFileSync(identityPath);
   const restored=JSON.parse(safeStorage.decryptString(b).toString());
   if(restored?.provider==='google'&&typeof restored.sub==='string'&&restored.sub.length<128 &&
      typeof restored.email==='string'&&restored.email.length<=254&&restored.emailVerified===true) identity=restored;
  }catch{identity=null}
 }
 load();
 function status(){
  const config=getConfig();
  return {configured:!!config.clientId,clientSecretConfigured:!!config.clientSecret,
          secureStorage:isStorageReady(),busy:!!pending,
          profile:identity?{provider:'google',name:identity.name,email:identity.email,
            emailVerified:true,linkedAt:identity.linkedAt,persisted:!!identity.persisted}:null};
 }
 function persist(profile){
  if(!isStorageReady())throw Error('无法使用系统加密存储身份信息，请继续使用本地模式');
  const encrypted=safeStorage.encryptString(JSON.stringify({...profile,persisted:true}));
  const tmp=identityPath+'.tmp';
  fs.writeFileSync(tmp,encrypted,{mode:0o600});
  fs.renameSync(tmp,identityPath);
 }
 function configure(clientId,clientSecret){
  if(pending)throw Error('Google 登录进行中，不能修改 OAuth 配置');
  if(!validClientId(clientId))throw Error('请填写 Google Cloud 创建的桌面应用 OAuth Client ID');
  const cleaned=clientId.trim();
  const current=safeJSON(fs.existsSync(configPath)?fs.readFileSync(configPath,'utf8'):'')||{};
  const next={clientId:cleaned};
  if(clientSecret!==undefined && clientSecret!==null){
   if(!isStorageReady())throw Error('系统加密存储不可用，无法保存 OAuth 客户端配置');
   if(typeof clientSecret!=='string'||clientSecret.trim().length<4||clientSecret.length>1024)
    throw Error('OAuth 客户端 JSON 不含有效的 client_secret');
   next.clientSecretCiphertext=safeStorage.encryptString(clientSecret.trim()).toString('base64');
  }else if(current.clientId===cleaned && typeof current.clientSecretCiphertext==='string'){
   next.clientSecretCiphertext=current.clientSecretCiphertext;
  }
  const tmp=configPath+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(next,null,2),{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,configPath);
  onChange?.(status());
  return status();
 }
 function importClientJSONFile(filePath){
  if(typeof filePath!=='string'||filePath.length>2048||path.extname(filePath).toLowerCase()!=='.json')
   throw Error('请选择 Google Cloud 下载的桌面 OAuth JSON 文件');
  const stat=fs.statSync(filePath);
  if(!stat.isFile()||stat.size>65536)throw Error('OAuth 配置文件大小或类型不正确');
  const parsed=safeJSON(fs.readFileSync(filePath,'utf8'));
  if(!parsed?.installed)throw Error('请选择类型为「桌面应用」的 Google OAuth JSON');
  return configure(parsed.installed.client_id,parsed.installed.client_secret);
 }
 async function getJSON(url,init){
  const step=url===GOOGLE_TOKEN?'令牌兑换':'账号信息获取';
  let res;
  try{
   res=await fetchImpl(url,{...init,redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'});
  }catch(e){
   const reason=String(e?.cause?.code||e?.code||e?.name||'network').slice(0,36);
   throw Error('Google '+step+'网络请求失败（'+reason+'），请检查系统代理、网络及证书设置后重试');
  }
  if(!res||!res.ok){
   if(url===GOOGLE_TOKEN && (res?.status===400||res?.status===401)){
    const payload=await res.json().catch(()=>({}));
    if(/client_secret.*missing|missing.*client_secret/i.test(String(payload?.error_description||'')))
     throw Error('Google 要求桌面客户端密钥。请在「应用 OAuth 配置」中导入原始 Google OAuth JSON 文件后重试');
    throw Error('Google 授权码兑换失败（HTTP '+res.status+'），请重新开始 Google 登录');
   }
   throw Error('Google '+step+'失败（HTTP '+(res?.status||'unknown')+'）');
  }
  const length=Number(res.headers?.get?.('content-length')||0);
  if(length>65536)throw Error('Google 响应超过安全限制');
  try{return await res.json()}catch{throw Error('Google '+step+'返回的数据无法解析')}
 }
 function completeCallbackPage(p,success){
  const res=p.response;
  if(!res||res.writableEnded||res.destroyed)return;
  const heading=success?'登录验证成功':'登录验证未完成';
  const message=success?'可以关闭此页面并返回 Agnovexa One。':'请返回 Agnovexa One 查看失败原因，然后重新尝试登录。';
  const ink=success?'#14624c':'#a33d45';
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store',
   'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer',
   'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
  res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Agnovexa One · Google 登录</title>'+
   '<style>body{font:15px system-ui;background:#f3f5f8;color:#273342;margin:0;padding:13vh 8%;text-align:center}'+
   'h2{font-size:22px;color:'+ink+'}p{line-height:1.8}</style><h2>'+heading+'</h2><p>'+message+'</p></html>');
 }
 async function exchangeCode(code,clientId,redirectUri,verifier){
  const params=new URLSearchParams({client_id:clientId,code,redirect_uri:redirectUri,
                                   grant_type:'authorization_code',code_verifier:verifier});
  const secret=getConfig().clientId===clientId?getConfig().clientSecret:null;
  if(secret)params.set('client_secret',secret);
  const token=await getJSON(GOOGLE_TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params.toString()});
  if(typeof token.access_token!=='string'||token.access_token.length<16)throw Error('Google 未返回有效的访问授权');
  const user=await getJSON(GOOGLE_USERINFO,{headers:{Authorization:'Bearer '+token.access_token}});
  if(typeof user.sub!=='string'||!user.sub||user.sub.length>127||typeof user.email!=='string'||
     user.email.length>254||user.email_verified!==true)throw Error('Google 未返回已验证的账号身份');
  return {provider:'google',sub:user.sub,name:String(user.name||user.email.split('@')[0]).slice(0,90),
          email:user.email,emailVerified:true,linkedAt:now()};
 }
 function finish(p){
  if(pending===p)pending=null;
  if(p.timeout)clearTimeout(p.timeout);
  try{p.server?.close?.()}catch{}
  onChange?.(status());
 }
 async function signIn(){
  const clientId=getClientId();
  if(!clientId)throw Error('尚未配置 Google OAuth Client ID，请先在偏好设置中完成应用接入配置');
  if(!isStorageReady())throw Error('Windows 系统加密能力不可用，已阻止不安全的登录缓存');
  if(pending)throw Error('已有 Google 登录窗口，请在系统浏览器完成登录');
  const state=randomBase64Url(),verifier=randomBase64Url(48),nonce=randomBase64Url();
  const p={server:null,timeout:null};
  pending=p;onChange?.(status());
  try{
   const server=serverFactory((req,res)=>{
    const host=req.headers.host;
    const remote=req.socket?.remoteAddress||'';
    const addr=server.address();
    if(req.method!=='GET'||req.url?.length>4096||
       !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||
       host!=='127.0.0.1:'+(addr&&addr.port)){
      res.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end('Not found');return;
    }
    let u;
    try{u=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400);res.end('Bad request');return}
    if(u.pathname!=='/oauth/google/callback'){
      res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;
    }
    if(!fixedEqual(u.searchParams.get('state'),state)){
      res.writeHead(403,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
      res.end('Invalid authorization state');return;
    }
    if(p.received){res.writeHead(409);res.end('Already received');return}
    p.received=true;
    // Do NOT report success before the token exchange, profile verification,
    // and encrypted local save all succeed.
    p.response=res;
    p.resolveCallback({code:u.searchParams.get('code'),error:u.searchParams.get('error')});
   });
   p.server=server;
   const callback=new Promise((resolve,reject)=>{p.resolveCallback=resolve;p.rejectCallback=reject});
   server.on('error',error=>{p.rejectCallback?.(Error('无法开启本机 Google 登录回调：'+error.message))});
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
   const address=server.address();
   if(!address||typeof address==='string')throw Error('无法分配本机回调端口');
   const redirectUri='http://127.0.0.1:'+address.port+'/oauth/google/callback';
   const url=new URL(GOOGLE_AUTH);
   Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',
     scope:SCOPES,state,nonce,code_challenge:challengeFor(verifier),code_challenge_method:'S256',
     access_type:'online',prompt:'select_account'}).forEach(([k,v])=>url.searchParams.set(k,v));
   p.timeout=setTimeout(()=>p.rejectCallback?.(Error('Google 登录超时，请重新尝试')),timeoutMs);
   await shell.openExternal(url.toString());
   const result=await callback;
   if(result.error)throw Error(result.error==='access_denied'?'你已取消 Google 授权':'Google 授权未完成：'+result.error);
   if(typeof result.code!=='string'||result.code.length<8)throw Error('Google 授权码无效');
   const profile=await exchangeCode(result.code,clientId,redirectUri,verifier);
   persist(profile);
   identity={...profile,persisted:true};
   onChange?.(status());
   completeCallbackPage(p,true);
   return {...status(),busy:false};
  }catch(error){
   completeCallbackPage(p,false);
   throw error;
  }finally{finish(p)}
 }
 function signOut(){
  if(pending)throw Error('请先完成当前登录');
  identity=null;
  if(fs.existsSync(identityPath))fs.rmSync(identityPath,{force:true});
  onChange?.(status());
  return status();
 }
 function cancel(){
  if(!pending)return false;
  pending.rejectCallback?.(Error('已取消 Google 登录'));
  finish(pending);
  return true;
 }
 return {status,configure,importClientJSONFile,signIn,signOut,cancel,getClientId};
}
module.exports={createGoogleIdentity,validClientId,challengeFor,SCOPES};
