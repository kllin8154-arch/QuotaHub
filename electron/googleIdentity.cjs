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
 function getClientId(){
  const env=process.env.QUOTAHUB_GOOGLE_CLIENT_ID?.trim();
  if(validClientId(env))return env;
  const value=safeJSON(fs.existsSync(configPath)?fs.readFileSync(configPath,'utf8'):'');
  return validClientId(value?.clientId)?value.clientId.trim():null;
 }
 function isStorageReady(){return Boolean(safeStorage.isEncryptionAvailable())}
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
  return {configured:!!getClientId(),secureStorage:isStorageReady(),busy:!!pending,
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
 function configure(clientId){
  if(pending)throw Error('Google 登录进行中，不能修改 OAuth 配置');
  if(!validClientId(clientId))throw Error('请填写 Google Cloud 创建的桌面应用 OAuth Client ID');
  const tmp=configPath+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({clientId:clientId.trim()},null,2),{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,configPath);
  onChange?.(status());
  return status();
 }
 async function getJSON(url,init){
  const res=await fetchImpl(url,{...init,redirect:'error',signal:AbortSignal.timeout(16000),cache:'no-store'});
  if(!res||!res.ok)throw Error('Google 登录验证失败（HTTP '+(res?.status||'unknown')+'）');
  const length=Number(res.headers?.get?.('content-length')||0);
  if(length>65536)throw Error('Google 响应超过安全限制');
  return res.json();
 }
 async function exchangeCode(code,clientId,redirectUri,verifier){
  const params=new URLSearchParams({client_id:clientId,code,redirect_uri:redirectUri,
                                   grant_type:'authorization_code',code_verifier:verifier});
  const token=await getJSON(GOOGLE_TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params});
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
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store',
      'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
    res.end('<!doctype html><html lang="zh"><meta charset="utf-8"><title>QuotaHub</title><style>body{font:15px system-ui;background:#f3f5f8;color:#273342;padding:12vh 8%;text-align:center}</style><h2>已返回 QuotaHub</h2><p>授权结果已接收，可以关闭本页面并返回应用。</p></html>');
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
   return {...status(),busy:false};
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
 return {status,configure,signIn,signOut,cancel,getClientId};
}
module.exports={createGoogleIdentity,validClientId,challengeFor,SCOPES};
