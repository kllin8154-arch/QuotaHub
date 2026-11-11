const { app, BrowserWindow, ipcMain, safeStorage, shell, screen, Menu, Tray, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const webQuota = require('./webQuota.cjs');
const { createGoogleIdentity } = require('./googleIdentity.cjs');
const dataDir = process.env.AIQUOTA_DATA_DIR || path.join(app.getPath('userData'), 'local-data');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
app.setAppUserModelId('com.aiquotahub.desktop');
const secretsPath = path.join(dataDir, 'secrets.json');
let googleIdentity = null;
function broadcastIdentity(status){
 for(const window of BrowserWindow.getAllWindows()){
  if(!window.isDestroyed()&&!window.webContents.isDestroyed()&&window.webContents.getURL().includes('index.html')){
   window.webContents.send('identity:changed',status);
  }
 }
}
ipcMain.handle('identity:status',()=>googleIdentity?.status()||{
 configured:false,secureStorage:false,busy:false,profile:null});
ipcMain.handle('identity:configure',(_event,id)=>googleIdentity?.configure(id));
ipcMain.handle('identity:signIn',()=>googleIdentity?.signIn());
ipcMain.handle('identity:signOut',()=>googleIdentity?.signOut());
ipcMain.handle('identity:cancel',()=>googleIdentity?.cancel());
const widgetAccountsPath = path.join(dataDir,'widget-accounts.json');
function cleanWidgetAccounts(list) {
 if(!Array.isArray(list))return [];
 return list.slice(0,30).filter(p=>p&&typeof p==='object'&&typeof p.id==='string')
 .map(p=>({
  id:p.id.slice(0,105),name:String(p.name||'未命名平台').slice(0,60),
  account:String(p.account||'').slice(0,65),
  kind:['relay','deepseek','chatgpt','openai-api','openrouter','claude','gemini','siliconflow','qwen','kimi','zhipu','cursor','custom'].includes(p.kind)?p.kind:'custom',
  value:typeof p.value==='number'&&Number.isFinite(p.value)?p.value:null,
  unit:String(p.unit||'').slice(0,18),
  metric:['balance','spend','usage'].includes(p.metric)?p.metric:'balance',
  connected:!!p.connected||!!p.webMonitored,
  webMonitored:!!p.webMonitored,source:['web','api','manual'].includes(p.source)?p.source:'manual',
  updatedAt:typeof p.updatedAt==='string'?p.updatedAt.slice(0,40):''
 }));
}
function getWidgetAccounts() {
 try{return cleanWidgetAccounts(JSON.parse(fs.readFileSync(widgetAccountsPath,'utf8')))}catch{return []}
}
function saveWidgetAccounts(accounts) {
 const list=cleanWidgetAccounts(accounts);
 fs.writeFileSync(widgetAccountsPath+'.tmp',JSON.stringify(list,null,2),'utf8');
 fs.renameSync(widgetAccountsPath+'.tmp',widgetAccountsPath);
 if(gadget&&!gadget.isDestroyed())applyWidgetBounds();
 if(gadget&&!gadget.isDestroyed()&&!gadget.webContents.isDestroyed())gadget.webContents.send('widget:accounts',list);
 return true;
}

const supported = new Set(['deepseek', 'openai-api', 'openrouter','relay']);
const allowedHosts = new Set(['platform.deepseek.com','chatgpt.com','platform.openai.com','claude.ai','gemini.google.com','cloud.siliconflow.cn','openrouter.ai','bailian.console.aliyun.com','www.kimi.com','open.bigmodel.cn','cursor.com','docs.newapi.ai','console.cloud.google.com']);
function loadSecrets() { try { const x=JSON.parse(fs.readFileSync(secretsPath,'utf8')); return x && typeof x==='object' && !Array.isArray(x) ? x : {}; } catch { return {}; } }
function saveSecrets(state) { const temp=secretsPath+'.tmp'; fs.writeFileSync(temp, JSON.stringify(state), {mode:0o600}); fs.renameSync(temp,secretsPath); }
function verify(kind,id) {
 if (!supported.has(kind)) throw new Error('该平台暂无官方额度读取适配器');
 if (typeof id!=='string' || !/^[a-z0-9][a-z0-9_-]{1,100}$/i.test(id)) throw new Error('无效的账号标识');
}
async function encrypt(key) {
 if (typeof safeStorage.encryptStringAsync==='function') {
  if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('系统安全存储不可用');
  return (await safeStorage.encryptStringAsync(key)).toString('base64');
 }
 if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用');
 return safeStorage.encryptString(key).toString('base64');
}
async function decrypt(encoded) {
 const data=Buffer.from(encoded,'base64');
 if (typeof safeStorage.decryptStringAsync==='function') return await safeStorage.decryptStringAsync(data);
 return safeStorage.decryptString(data);
}
async function fetchJson(url,key) {
 const res=await fetch(url, {headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(12000),cache:'no-store',redirect:'error'});
 if (!res.ok) throw new Error(res.status===401 || res.status===403 ? '凭证错误或权限不足，请检查密钥类型' : '平台请求失败（HTTP '+res.status+'）');
 return res.json();
}

function isPublicIP(ip) {
 if(net.isIP(ip)===4){
  const v=ip.split('.').map(Number),[a,b,c]=v;
  if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0&&c===0||a===192&&b===0&&c===2||a===198&&b===51&&c===100||a===203&&b===0&&c===113||a===198&&b>=18&&b<=19)return false;
  return true;
 }
 if(net.isIP(ip)===6){
  const lower=ip.toLowerCase();
  if(lower==='::1'||lower==='::'||lower.startsWith('fc')||lower.startsWith('fd')||lower.startsWith('fe8')||lower.startsWith('fe9')||lower.startsWith('fea')||lower.startsWith('feb')||lower.startsWith('2001:db8')||lower.startsWith('::ffff:'))return false;
  return true;
 }
 return false;
}
function relayConfig(input) {
 if(!input||typeof input!=='object')throw new Error('请填写中转站连接配置');
 if(!['newapi-account','newapi-key','custom'].includes(input.mode))throw new Error('未知的中转站接入类型');
 let parsed;
 try {parsed=new URL(input.baseUrl)}catch{throw new Error('中转站 URL 无效')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port&&parsed.port!=='443'||parsed.search||parsed.hash||!parsed.hostname||parsed.hostname.length>220||net.isIP(parsed.hostname)||parsed.hostname==='localhost'||!parsed.hostname.includes('.'))throw new Error('中转站只允许公开域名的 HTTPS 地址');
 if(!/^\/[a-zA-Z0-9._~/-]*$/.test(parsed.pathname))throw new Error('站点基础路径不支持特殊字符');
 const baseUrl=parsed.origin+parsed.pathname.replace(/\/+$/,'').replace(/\/(?:v1|v1beta)$/,'');
 const mode=input.mode;
 const userId=String(input.userId||'').trim();
 if(mode==='newapi-account'&&!/^[0-9]{1,12}$/.test(userId))throw new Error('New API 账户模式需要数字用户 ID');
 const path=mode==='newapi-account'?'/api/user/self':mode==='newapi-key'?'/api/usage/token/':String(input.path||'').trim();
 if(!/^\/[a-zA-Z0-9._~/-]{1,100}$/.test(path)||path.includes('..')||path.includes('//'))throw new Error('请填写合法的查询路径');
 const field=String(input.field||'data.balance').trim();
 if(mode==='custom'&&!/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*|\.[0-9]+){0,9}$/.test(field))throw new Error('JSON 余额字段格式不正确');
 const unit=String(input.unit||'额度点').trim().slice(0,16)||'额度点';
 const divisor=Number(input.divisor||1);
 if(!Number.isFinite(divisor)||divisor<=0||divisor>1e12)throw new Error('额度换算除数不正确');
 return {baseUrl,mode,userId,path,field,unit,divisor};
}
function jsonField(object,field) {
 return field.split('.').reduce((v,k)=>v?.[k],object);
}
function relayGet(endpoint,key,userId) {
 return new Promise((resolve,reject)=>{
  const url=new URL(endpoint);
  const req=https.request(url,{
   method:'GET',
   timeout:12000,
   maxHeaderSize:8192,
   headers:{Authorization:'Bearer '+key,Accept:'application/json',...(userId?{'New-Api-User':userId}:{})},
   lookup:(hostname,opts,callback)=>{
    dns.lookup(hostname,{all:true,verbatim:true},(err,ips)=>{
     if(err)return callback(err);
     if(!ips?.length||ips.some(x=>!isPublicIP(x.address)))return callback(new Error('域名解析到内网或保留地址，拒绝连接'));
     const ip=ips[0];callback(null,ip.address,ip.family);
    });
   }
  },res=>{
   if(res.statusCode<200||res.statusCode>=300){res.resume();reject(new Error('中转站返回 HTTP '+res.statusCode));return}
   let total=0,buf='';
   res.on('data',chunk=>{total+=chunk.length;if(total>131072){req.destroy(new Error('响应超过安全限制'));return}buf+=chunk.toString('utf8')});
   res.on('end',()=>{try{resolve(JSON.parse(buf))}catch{reject(new Error('中转站返回内容不是 JSON'))}});
  });
  req.on('timeout',()=>req.destroy(new Error('连接中转站超时')));
  req.on('error',reject);
  req.end();
 });
}
async function fetchRelay(key,input) {
 const cfg=relayConfig(input);
 const response=await relayGet(cfg.baseUrl+cfg.path,key,cfg.mode==='newapi-account'?cfg.userId:'');
 if(response?.success===false||response?.code===false)throw new Error(String(response.message||'中转站认证失败').slice(0,100));
 let raw;
 if(cfg.mode==='newapi-account')raw=response?.data?.quota;
 else if(cfg.mode==='newapi-key'){
  if(response?.data?.unlimited_quota===true)throw new Error('该密钥不限额度，无法表示为有限余额');
  raw=response?.data?.total_available??response?.data?.remain_quota??response?.data?.remaining_quota;
 }
 else raw=jsonField(response,cfg.field);
 if(raw===null||raw===undefined||String(raw).trim()==='')throw new Error('余额字段缺失，请确认接口类型及权限');
 const val=Number(raw);
 if(!Number.isFinite(val))throw new Error('中转站余额不是有效数字');
 return {value:val/cfg.divisor,unit:cfg.unit,metric:'balance',updatedAt:new Date().toISOString()};
}

async function fetchLive(kind,key,relay) {
 if(kind==='relay')return fetchRelay(key,relay);
 if (kind==='deepseek') {
  const json=await fetchJson('https://api.deepseek.com/user/balance',key);
  if (!Array.isArray(json.balance_infos)) throw new Error('DeepSeek 返回数据格式不正确');
  const account=json.balance_infos.find(x=>x.currency==='CNY') || json.balance_infos[0];
  if (!account) throw new Error('未返回余额信息');
  const value=Number(account.total_balance), bonus=Number(account.granted_balance);
  if (!Number.isFinite(value)) throw new Error('余额数据无效');
  return {metric:'balance',unit:account.currency,value,bonus:Number.isFinite(bonus)?bonus:0,updatedAt:new Date().toISOString()};
 }
 if (kind==='openrouter') {
  const json=await fetchJson('https://openrouter.ai/api/v1/credits',key);
  const credits=Number(json.data?.total_credits), usage=Number(json.data?.total_usage);
  if (!Number.isFinite(credits) || !Number.isFinite(usage)) throw new Error('OpenRouter 返回数据格式不正确');
  return {metric:'balance',unit:'USD',value:Number(Math.max(0,credits-usage).toFixed(4)),updatedAt:new Date().toISOString()};
 }
 const now=new Date();
 const start=Math.floor(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)/1000);
 const end=Math.floor(Date.now()/1000)+1;
 const query=new URLSearchParams({start_time:String(start),end_time:String(end),bucket_width:'1d',limit:'40'});
 const json=await fetchJson('https://api.openai.com/v1/organization/costs?'+query.toString(),key);
 if (!Array.isArray(json.data)) throw new Error('OpenAI 返回数据格式不正确');
 const daily=json.data.map(bucket=>(bucket.results||[]).reduce((sum,item)=>sum+(Number(item.amount?.value)||0),0));
 return {metric:'spend',unit:'USD',value:Number(daily.reduce((a,b)=>a+b,0).toFixed(4)),daily,updatedAt:new Date().toISOString()};
}
function notifyQuota(payload){
 if(payload.type==='linked' && payload.point && payload.provider){
  const p=payload.provider;
  const list=getWidgetAccounts();
  const account={
   id:p.id,name:p.name||'DeepSeek API',account:'',
   kind:p.kind,value:payload.point.value,unit:payload.point.unit,metric:payload.point.metric,
   connected:true,webMonitored:true,source:'web',updatedAt:payload.point.at
  };
  saveWidgetAccounts(list.some(x=>x.id===p.id)?
   list.map(x=>x.id===p.id?{...x,...account}:x):[...list,account]);
  // Successful first account read completes the flow without requiring another click.
  const dashboard=BrowserWindow.getAllWindows().find(w=>
   !w.isDestroyed()&&!w.webContents.isDestroyed()&&w.webContents.getURL().includes('index.html'));
  if(dashboard){dashboard.show();dashboard.focus()}
  else createWindow();
 }

  if(payload.type==='snapshot' && payload.point && Number.isFinite(payload.point.value)){
   const list=getWidgetAccounts();
   if(list.some(p=>p.id===payload.point.id)){
    saveWidgetAccounts(list.map(p=>p.id===payload.point.id?{
      ...p,value:payload.point.value,limit:payload.point.limit,unit:payload.point.unit,
      metric:payload.point.metric,updatedAt:payload.point.at,
      connected:true,webMonitored:payload.point.source==='web'||p.webMonitored,
      source:payload.point.source
    }:p));
   }
  }
  for(const win of BrowserWindow.getAllWindows()){
   if(!win.isDestroyed()&&!win.webContents.isDestroyed() && win.webContents.getURL().includes('index.html')){
    win.webContents.send('quota:snapshot',payload);
   }
  }
}
ipcMain.handle('quota:updateWidgetAccounts',(_,accounts)=>saveWidgetAccounts(accounts));
ipcMain.handle('widget:getAccounts',()=>getWidgetAccounts());
let apiPolling=false;
async function refreshConnectedApiAccounts(){
 if(apiPolling)return;
 apiPolling=true;
 try{
  const accounts=getWidgetAccounts(),creds=loadSecrets();
  for(const p of accounts){
   const entry=creds[p.id];
   if(!entry?.cipher || entry.kind!==p.kind || !supported.has(entry.kind))continue;
   if(webQuota.hasBinding(p.id))continue;
   try{
    const result=await fetchLive(entry.kind,await decrypt(entry.cipher),entry.relay);
    const point={id:p.id,kind:p.kind,value:result.value,unit:result.unit,
      metric:result.metric,limit:p.limit,at:result.updatedAt||new Date().toISOString(),source:'api'};
    webQuota.record(point);
    notifyQuota({type:'snapshot',point});
   }catch(err){notifyQuota({type:'stale',id:p.id,reason:'官方 API 暂时无法同步'})}
  }
 }finally{apiPolling=false}
}
ipcMain.handle('widget:refreshAccounts',async()=>{
 const originals=getWidgetAccounts();
 const credentials=loadSecrets();
 const updated=await Promise.all(originals.map(async p=>{
  const secret=credentials[p.id];
  if(!p.connected||!secret?.cipher||!supported.has(secret.kind)||webQuota.hasBinding(p.id))return p;
  try {
   const result=await fetchLive(secret.kind,await decrypt(secret.cipher),secret.relay);
   const point={id:p.id,kind:p.kind,value:result.value,unit:result.unit,
     metric:result.metric,limit:p.limit,at:result.updatedAt||new Date().toISOString(),source:'api'};
   webQuota.record(point);
   notifyQuota({type:'snapshot',point});
   return {...p,value:result.value,unit:result.unit,metric:result.metric,updatedAt:result.updatedAt};
  }catch{return p}
 }));
 saveWidgetAccounts(updated);
 return updated;
});
ipcMain.handle('quota:connected',()=>Object.entries(loadSecrets()).filter(([,v])=>v && typeof v==='object' && supported.has(v.kind)).map(([id])=>id));
ipcMain.handle('quota:connect',async(_,kind,id,key,relay)=>{
 verify(kind,id);
 if (typeof key!=='string' || key.trim().length<8 || key.length>4096) throw new Error('请输入有效的官方密钥');
 const safeRelay=kind==='relay'?relayConfig(relay):null;
 const value=await fetchLive(kind,key.trim(),safeRelay);
 const secrets=loadSecrets();secrets[id]={kind,cipher:await encrypt(key.trim()),...(safeRelay?{relay:safeRelay}:{})};saveSecrets(secrets);
 return value;
});
ipcMain.handle('quota:refresh',async(_,kind,id)=>{
 verify(kind,id);
 const entry=loadSecrets()[id];
 if (!entry || entry.kind!==kind || typeof entry.cipher!=='string') throw new Error('该账号尚未绑定，请先连接');
 return fetchLive(kind,await decrypt(entry.cipher),entry.relay);
});
ipcMain.handle('quota:disconnect',(_,kind,id)=>{
 verify(kind,id);const secrets=loadSecrets();
 if (secrets[id]?.kind===kind) {delete secrets[id];saveSecrets(secrets)}
 return true;
});
ipcMain.handle('quota:openExternal',async(_,raw)=>{
 if (typeof raw!=='string' || raw.length>2048) throw new Error('无效地址');
 const url=new URL(raw);
 if (url.protocol!=='https:' || !allowedHosts.has(url.hostname)) throw new Error('不支持的官方地址');
 await shell.openExternal(url.href);
});
function createWindow() {
 const win=new BrowserWindow({width:1440,height:910,minWidth:880,minHeight:650,backgroundColor:'#08090d',title:'AI Quota Hub',autoHideMenuBar:true,show:false,
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:' && allowedHosts.has(u.hostname)) shell.openExternal(url);}catch{}return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{
  if (url.startsWith('http://127.0.0.1:5173/')||url.startsWith('file://'))return;
  event.preventDefault();
  try{const u=new URL(url);if(u.protocol==='https:' && allowedHosts.has(u.hostname))shell.openExternal(url);}catch{}
 });
 if(!app.isPackaged && process.env.AIQUOTA_DEV==='1')win.loadURL('http://127.0.0.1:5173/');
 else win.loadFile(path.join(__dirname,'../dist/index.html'));
}
let gadget;
let frameAdjustmentUntil=0;
let resizeInteractionUntil=0;
let positionTimer=null;
const sizes={card:[390,320],rail:[668,192],side:[332,430]};
const emptySizes={card:[390,235],rail:[668,158],side:[332,260]};
function expandedDimensions(){
 const n=Math.min(5,getWidgetAccounts().length);
 const base=(n?sizes:emptySizes)[widgetSettings.layout];
 const autoHeight=widgetSettings.layout==='card'?Math.min(310,Math.max(215,128+58*Math.min(n,3))):
   widgetSettings.layout==='side'?Math.min(490,148+64*Math.min(n,5)):base[1];
 return [Number.isInteger(widgetSettings.customWidth)?widgetSettings.customWidth:base[0],
         Number.isInteger(widgetSettings.customHeight)?widgetSettings.customHeight:
           n?autoHeight:base[1]];
}
const miniSizes={edge:[44,108],orb:[68,68],island:[244,66]};
const settingsPath=path.join(dataDir,'widget-settings.json');
const defaults={layout:'card',tint:'smoke',logo:'ring',opacity:91,pin:false,showTaskbar:true,
 customWidth:null,customHeight:null,x:null,y:null,compactX:null,compactY:null,
 collapseMode:'edge',collapsed:false,dockSide:'right'};
function readWidgetSettings(){
 let raw={};
 try{raw=JSON.parse(fs.readFileSync(settingsPath,'utf8'))}catch{}
 if(!raw||typeof raw!=='object')raw={};
 const result={...defaults};
 if(Object.hasOwn(sizes,raw.layout))result.layout=raw.layout;
 if(['smoke','clear','warm'].includes(raw.tint))result.tint=raw.tint;
 if(['bars','ring','layers'].includes(raw.logo))result.logo=raw.logo;
 if(Number.isInteger(raw.opacity))result.opacity=Math.min(95,Math.max(25,raw.opacity));
 if(typeof raw.pin==='boolean')result.pin=raw.pin;
 if(typeof raw.showTaskbar==='boolean')result.showTaskbar=raw.showTaskbar;
 if(['none','edge','orb','island'].includes(raw.collapseMode))result.collapseMode=raw.collapseMode;
 if(typeof raw.collapsed==='boolean')result.collapsed=raw.collapsed&&result.collapseMode!=='none';
 if(['left','right'].includes(raw.dockSide))result.dockSide=raw.dockSide;
 for(const prop of ['x','y','compactX','compactY'])if(Number.isFinite(raw[prop]))result[prop]=Math.trunc(raw[prop]);
 for(const prop of ['customWidth','customHeight']){
  const min=prop==='customWidth'?305:185;
  if(Number.isInteger(raw[prop]))result[prop]=Math.min(prop==='customWidth'?1080:850,Math.max(min,raw[prop]));
 }
 return result;
}
let widgetSettings=readWidgetSettings();
function saveWidgetSettings(){
 const tmp=settingsPath+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(widgetSettings,null,2),'utf8');
 fs.renameSync(tmp,settingsPath);
}
function currentDimensions(){
 return widgetSettings.collapsed?miniSizes[widgetSettings.collapseMode]||miniSizes.orb:expandedDimensions();
}
function workAreaFor(x,y,w,h){
 if(Number.isFinite(x)&&Number.isFinite(y))return screen.getDisplayMatching({x,y,width:w,height:h}).workArea;
 return screen.getPrimaryDisplay().workArea;
}
function clampRect(x,y,width,height,a){
 return {x:Math.round(Math.max(a.x,Math.min(x,a.x+a.width-width))),
         y:Math.round(Math.max(a.y,Math.min(y,a.y+a.height-height))),width,height};
}
function expandBounds(){
 const [width,height]=expandedDimensions();
 const a=workAreaFor(widgetSettings.x,widgetSettings.y,width,height);
 const x=Number.isFinite(widgetSettings.x)?widgetSettings.x:a.x+a.width-width-60;
 const y=Number.isFinite(widgetSettings.y)?widgetSettings.y:a.y+82;
 return clampRect(x,y,width,height,a);
}
function widgetBounds(){
 if(!widgetSettings.collapsed)return expandBounds();
 const mode=widgetSettings.collapseMode;
 const [width,height]=miniSizes[mode]||miniSizes.orb;
 const full=expandBounds();
 const a=workAreaFor(full.x,full.y,full.width,full.height);
 if(mode==='edge'){
   const x=widgetSettings.dockSide==='left'?a.x+2:a.x+a.width-width-2;
   const y=Number.isFinite(widgetSettings.compactY)?widgetSettings.compactY:full.y+Math.min(28,full.height/5);
   return clampRect(x,y,width,height,a);
 }
 if(mode==='island'){
   return clampRect(a.x+(a.width-width)/2,a.y+13,width,height,a);
 }
 const x=Number.isFinite(widgetSettings.compactX)?widgetSettings.compactX:full.x+full.width-width;
 const y=Number.isFinite(widgetSettings.compactY)?widgetSettings.compactY:full.y;
 return clampRect(x,y,width,height,a);
}
function broadcastWidgetSettings(){
 if(gadget&&!gadget.isDestroyed()&&!gadget.webContents.isDestroyed())gadget.webContents.send('widget:settings',{...widgetSettings});
}
function applyWidgetBounds(){
 if(!gadget||gadget.isDestroyed())return;
 frameAdjustmentUntil=Date.now()+1200;
 const bounds=widgetBounds();
 gadget.setBounds(bounds);
}
function resizeWidget(width,height){
 if(widgetSettings.collapsed||!gadget||gadget.isDestroyed())return false;
 const minW=widgetSettings.layout==='rail'?470:305;
 const minH=widgetSettings.layout==='rail'?150:185;
 if(!Number.isFinite(width)||!Number.isFinite(height))return false;
 const nextW=Math.max(minW,Math.min(1080,Math.round(width)));
 const nextH=Math.max(minH,Math.min(850,Math.round(height)));
 widgetSettings.customWidth=nextW;
 widgetSettings.customHeight=nextH;
 resizeInteractionUntil=Date.now()+2500;
 applyWidgetBounds();
 clearTimeout(resizeSaveTimer);
 resizeSaveTimer=setTimeout(()=>{saveWidgetSettings();broadcastWidgetSettings()},450);
 return true;
}
let resizeSaveTimer=null;
function setWidgetLayout(layout){
 if(!Object.hasOwn(sizes,layout))return false;
 widgetSettings.layout=layout;
 widgetSettings.customWidth=null;widgetSettings.customHeight=null;
 applyWidgetBounds();
 saveWidgetSettings();broadcastWidgetSettings();return true;
}
function setWidgetAppearance(changes){
 if(['smoke','clear','warm'].includes(changes.tint))widgetSettings.tint=changes.tint;
 if(['bars','ring','layers'].includes(changes.logo))widgetSettings.logo=changes.logo;
 if(Number.isInteger(changes.opacity))widgetSettings.opacity=Math.max(25,Math.min(95,changes.opacity));
 if(typeof changes.pin==='boolean'){
  widgetSettings.pin=changes.pin;
  if(gadget&&!gadget.isDestroyed()){
   gadget.setAlwaysOnTop(changes.pin,'floating');
   if(changes.pin)bringWidgetToFront();
  }
 }
 saveWidgetSettings();broadcastWidgetSettings();return true;
}
function setCollapsed(collapsed,modeOverride){
 if(modeOverride&&['edge','orb','island','none'].includes(modeOverride))widgetSettings.collapseMode=modeOverride;
 if(widgetSettings.collapseMode==='none')collapsed=false;
 if(collapsed&&!widgetSettings.collapsed){
  widgetSettings.compactX=null;widgetSettings.compactY=null;
  if(gadget&&!gadget.isDestroyed()){
   const [x,y]=gadget.getPosition();
   widgetSettings.x=x;widgetSettings.y=y;
   const [width,height]=gadget.getSize();
   const a=workAreaFor(x,y,width,height);
   widgetSettings.dockSide=x+width/2<a.x+a.width/2?'left':'right';
  }
 }
 if(!collapsed&&widgetSettings.collapsed&&widgetSettings.collapseMode==='orb'&&gadget&&!gadget.isDestroyed()){
  const [x,y]=gadget.getPosition();
  if(Number.isFinite(x)&&Number.isFinite(y)){
   const [w]=expandedDimensions();
   const [cw]=miniSizes.orb;
   const a=workAreaFor(x,y,cw,cw);
   widgetSettings.x=Math.max(a.x,Math.min(x-(w-cw),a.x+a.width-w));
   widgetSettings.y=y;
  }
 }
 widgetSettings.collapsed=!!collapsed;
 applyWidgetBounds();
 saveWidgetSettings();broadcastWidgetSettings();
 if(!widgetSettings.collapsed)bringWidgetToFront();
 return {...widgetSettings};
}
function setCollapseMode(mode){
 if(!['none','edge','orb','island'].includes(mode))return {...widgetSettings};
 if(mode==='none')return setCollapsed(false,'none');
 if(mode==='edge'){
  const wasCollapsed=widgetSettings.collapsed;
  widgetSettings.collapseMode='edge';
  return setCollapsed(wasCollapsed);
 }
 return setCollapsed(true,mode);
}
function resetWidgetPosition(){
 widgetSettings.x=null;widgetSettings.y=null;widgetSettings.compactX=null;widgetSettings.compactY=null;
 applyWidgetBounds();saveWidgetSettings();broadcastWidgetSettings();return true;
}
function widgetMenu(){
 const layouts={card:'卡片',rail:'横向信息条',side:'侧边监视器'};
 const tints={smoke:'烟灰',clear:'冰白',warm:'暖灰'};
 const modes={none:'不收起',edge:'靠边自动收缩',orb:'悬浮球',island:'灵动岛'};
 return Menu.buildFromTemplate([
  {label:widgetSettings.collapsed?'展开组件':'收起组件',click:()=>setCollapsed(!widgetSettings.collapsed,widgetSettings.collapseMode==='none'?'orb':undefined)},
  {label:'收纳方式',submenu:Object.keys(modes).map(mode=>({
   label:modes[mode],type:'radio',checked:widgetSettings.collapseMode===mode,
   click:()=>setCollapseMode(mode)
  }))},
  {label:'组件布局',submenu:Object.keys(layouts).map(layout=>({
   label:layouts[layout],type:'radio',checked:widgetSettings.layout===layout,click:()=>setWidgetLayout(layout)
  }))},
  {label:'玻璃颜色',submenu:Object.keys(tints).map(tint=>({
   label:tints[tint],type:'radio',checked:widgetSettings.tint===tint,
   click:()=>setWidgetAppearance({tint})
  }))},
  {label:'品牌图标',submenu:[['bars','数据柱'],['ring','额度环'],['layers','叠层']].map(([logo,label])=>({
   label,type:'radio',checked:widgetSettings.logo===logo,click:()=>setWidgetAppearance({logo})
  }))},
  {label:'透明度',submenu:[35,50,65,74,85,95].map(opacity=>({
   label:opacity+'%',type:'radio',checked:widgetSettings.opacity===opacity,
   click:()=>setWidgetAppearance({opacity})
  }))},
  {label:'始终置顶',type:'checkbox',checked:widgetSettings.pin,
   click:item=>setWidgetAppearance({pin:item.checked})},
  {label:'恢复默认位置',click:()=>resetWidgetPosition()},
  {type:'separator'},
  {label:'打开额度管理',click:()=>createWindow()},
  {label:'退出组件',click:()=>app.quit()}
 ]);
}
function createWidget(){
 const bounds=widgetBounds();
 gadget=new BrowserWindow({
  ...bounds,minWidth:bounds.width,maxWidth:bounds.width,minHeight:bounds.height,maxHeight:bounds.height,
  frame:false,transparent:true,hasShadow:false,skipTaskbar:!widgetSettings.showTaskbar,alwaysOnTop:widgetSettings.pin,
  autoHideMenuBar:true,show:false,resizable:false,movable:true,minimizable:true,fullscreenable:false,
  backgroundColor:'#00000000',
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
 });
 gadget.once('ready-to-show',()=>{gadget.showInactive();if(widgetSettings.pin)gadget.setAlwaysOnTop(true,'floating');updateTrayMenu()});
 gadget.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 gadget.webContents.on('context-menu',()=>widgetMenu().popup({window:gadget}));
 gadget.webContents.on('did-finish-load',()=>broadcastWidgetSettings());
 gadget.on('move',()=>{
  if(Date.now()<frameAdjustmentUntil||Date.now()<resizeInteractionUntil)return;
  clearTimeout(positionTimer);
  positionTimer=setTimeout(()=>{
   if(!gadget||gadget.isDestroyed()||Date.now()<frameAdjustmentUntil||Date.now()<resizeInteractionUntil)return;
   const [x,y]=gadget.getPosition();
   const [width,height]=gadget.getSize();
   if(widgetSettings.collapsed){
    if(widgetSettings.collapseMode==='orb'){widgetSettings.compactX=x;widgetSettings.compactY=y;}
    if(widgetSettings.collapseMode==='edge'){widgetSettings.compactY=y;}
   }else{
    widgetSettings.x=x;widgetSettings.y=y;
    if(widgetSettings.collapseMode==='edge'){
     const a=workAreaFor(x,y,width,height);
     const leftGap=x-a.x;
     const rightGap=a.x+a.width-(x+width);
     if(leftGap<=26||rightGap<=26){
      widgetSettings.dockSide=leftGap<rightGap?'left':'right';
      setCollapsed(true);
      return;
     }
    }
   }
   saveWidgetSettings();
  },660);
 });
 gadget.on('minimize',()=>updateTrayMenu());
 gadget.on('restore',()=>{if(widgetSettings.pin)gadget.setAlwaysOnTop(true,'floating');updateTrayMenu()});
 gadget.on('closed',()=>{clearTimeout(positionTimer);gadget=null;updateTrayMenu()});
 const file=path.join(__dirname,'../dist/desktop-studio.html');
 gadget.loadFile(file,{query:{runtime:'1',layout:widgetSettings.layout}}).catch(err=>console.error('Widget load failed',err.message));
}

let tray=null;
let allowQuit=false;

let widgetRaiseTimer=null;
function hideWidgetToTray(){
 if(!gadget||gadget.isDestroyed())return false;
 clearTimeout(widgetRaiseTimer);
 // Hide the window completely; the independent Tray object keeps the process reachable.
 gadget.hide();
 updateTrayMenu();
 return true;
}
function bringWidgetToFront(){
 if(!gadget||gadget.isDestroyed())return;
 const w=gadget;
 if(w.isMinimized())w.restore();
 // Restore the user's optional taskbar preference when the tray icon is clicked.
 w.setSkipTaskbar(!widgetSettings.showTaskbar);
 w.show();
 w.setAlwaysOnTop(true,'floating');
 w.moveTop();
 w.focus();
 clearTimeout(widgetRaiseTimer);
 if(!widgetSettings.pin){
   widgetRaiseTimer=setTimeout(()=>{
     if(gadget===w && !w.isDestroyed() && !widgetSettings.pin)w.setAlwaysOnTop(false);
   },1100);
 }
}

function ensureWidgetVisible() {
 if(!gadget||gadget.isDestroyed())createWidget();
 else bringWidgetToFront();
 updateTrayMenu();
}
function toggleWidgetVisible() {
 if(!gadget||gadget.isDestroyed()){createWidget();return;}
 if(gadget.isMinimized())bringWidgetToFront();
 else if(gadget.isVisible())hideWidgetToTray();
 else bringWidgetToFront();
 updateTrayMenu();
}
function updateTrayMenu() {
 if(!tray||tray.isDestroyed())return;
 const visible=!!gadget&&!gadget.isDestroyed()&&gadget.isVisible();
 const layouts={card:'卡片',rail:'横条',side:'侧栏'};
 const modes={none:'保持展开',edge:'贴边收缩',orb:'悬浮球',island:'灵动岛'};
 const menu=Menu.buildFromTemplate([
  {label:gadget&&gadget.isVisible()?'收至系统托盘':'显示桌面组件',click:()=>toggleWidgetVisible()},
  {label:widgetSettings.collapsed?'展开':'收起',click:()=>{setCollapsed(!widgetSettings.collapsed,widgetSettings.collapseMode==='none'?'orb':undefined);ensureWidgetVisible()}},
  {type:'separator'},
  {label:'组件布局',submenu:Object.entries(layouts).map(([layout,label])=>({
   label,type:'radio',checked:widgetSettings.layout===layout,click:()=>setWidgetLayout(layout)
  }))},
  {label:'收纳形态',submenu:Object.entries(modes).map(([mode,label])=>({
   label,type:'radio',checked:widgetSettings.collapseMode===mode,click:()=>setCollapseMode(mode)
  }))},
  {label:'玻璃透明度',submenu:[35,50,58,65,74,85,95].map(opacity=>({
   label:opacity+'%',type:'radio',checked:widgetSettings.opacity===opacity,
   click:()=>setWidgetAppearance({opacity})
  }))},
  {label:'始终置顶',type:'checkbox',checked:widgetSettings.pin,click:item=>setWidgetAppearance({pin:item.checked})},
  {label:'显示任务栏按钮',type:'checkbox',checked:!!widgetSettings.showTaskbar,
    click:item=>{widgetSettings.showTaskbar=item.checked;saveWidgetSettings();if(gadget&&!gadget.isDestroyed())gadget.setSkipTaskbar(!widgetSettings.showTaskbar);updateTrayMenu();}},
  {type:'separator'},
  {label:'打开额度管理',click:()=>createWindow()},
  {label:'重新启动 QuotaHub',click:()=>{
    // app.exit() skips before-quit and the browser's normal session teardown.
    webQuota.flushPersistentSessions();
    app.relaunch();
    allowQuit=true;
    app.quit();
  }},
  {label:'彻底退出',click:()=>{allowQuit=true;app.quit()}}
 ]);
 tray.setContextMenu(menu);
}
function setupTray(){
 try {
  const iconPath=path.join(__dirname,'../dist/app-icon.ico');
  const png=path.join(__dirname,'../dist/app-icon.png');
  let icon=nativeImage.createFromPath(fs.existsSync(iconPath)?iconPath:png);
  if(icon.isEmpty())icon=nativeImage.createFromPath(png);
  if(icon.isEmpty())throw Error('Tray icon not found');
  tray=new Tray(icon.resize({width:20,height:20}));
  tray.setToolTip('QuotaHub · 左键显示/隐藏，右键设置与退出');
  tray.on('click',()=>toggleWidgetVisible());
  tray.on('double-click',()=>{ensureWidgetVisible()});
  updateTrayMenu();
 }catch(error){console.error('QuotaHub tray initialization failed:',error.message)}
}

ipcMain.handle('widget:setAppearance',(_,changes)=>{
 if(!changes||typeof changes!=='object')return {...widgetSettings};
 setWidgetAppearance(changes);
 return {...widgetSettings};
});
ipcMain.handle('widget:hideToTray',()=>hideWidgetToTray());
ipcMain.handle('widget:resize',(_,width,height)=>resizeWidget(width,height));
ipcMain.handle('widget:setLayout',(_,layout)=>setWidgetLayout(layout));
ipcMain.handle('widget:getSettings',()=>({...widgetSettings}));
ipcMain.handle('widget:toggle',()=>setCollapsed(!widgetSettings.collapsed,widgetSettings.collapseMode==='none'?'orb':undefined));
ipcMain.handle('widget:setCollapseMode',(_,mode)=>setCollapseMode(mode));
ipcMain.handle('widget:dashboard',()=>{createWindow();return true});
app.whenReady().then(()=>{
 googleIdentity=createGoogleIdentity({dataDir,safeStorage,shell,onChange:broadcastIdentity});
 webQuota.register({dir:dataDir,onUpdate:notifyQuota});
 setInterval(()=>void refreshConnectedApiAccounts(),90000).unref?.();
 setupTray();
 if(process.argv.includes('--dashboard'))createWindow();else createWidget();
 app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length){
  if(process.argv.includes('--dashboard'))createWindow();else createWidget();
 }});
});

app.on('before-quit',()=>{
 googleIdentity?.cancel();
 // Persist DOM storage before Electron closes the web session partitions.
 webQuota.flushPersistentSessions();
 webQuota.shutdown();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});