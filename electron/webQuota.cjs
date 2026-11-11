'use strict';
const { BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITES = Object.freeze({
  chatgpt:{url:'https://chatgpt.com/settings/usage',hosts:['chatgpt.com'],auth:['auth.openai.com','openai.com','login.openai.com','accounts.google.com','login.microsoftonline.com','appleid.apple.com']},
  claude:{url:'https://claude.ai/settings/usage',hosts:['claude.ai'],auth:['accounts.google.com','auth.anthropic.com']},
  gemini:{url:'https://gemini.google.com/',hosts:['gemini.google.com'],auth:['accounts.google.com','accounts.youtube.com']},
  deepseek:{url:'https://platform.deepseek.com/usage',hosts:['platform.deepseek.com'],auth:[]},
  'openai-api':{url:'https://platform.openai.com/usage',hosts:['platform.openai.com'],auth:['auth.openai.com','openai.com','login.openai.com','accounts.google.com','login.microsoftonline.com','appleid.apple.com']},
  openrouter:{url:'https://openrouter.ai/activity',hosts:['openrouter.ai'],auth:[]},
  siliconflow:{url:'https://cloud.siliconflow.cn/',hosts:['cloud.siliconflow.cn'],auth:[]},
  qwen:{url:'https://bailian.console.aliyun.com/',hosts:['bailian.console.aliyun.com'],auth:['login.aliyun.com','account.aliyun.com']},
  kimi:{url:'https://www.kimi.com/',hosts:['www.kimi.com'],auth:['kimi.com']},
  zhipu:{url:'https://open.bigmodel.cn/',hosts:['open.bigmodel.cn'],auth:[]},
  cursor:{url:'https://cursor.com/dashboard',hosts:['cursor.com'],auth:[]}
});

const windows=new Map();
let shuttingDown=false;
let dataPath;
let bindingsPath;
let historyPath;
let notify=()=>{};
let timer=null;
let flushTimer=null;
function safeId(id){if(typeof id!=='string'||!/^[\w-]{2,110}$/.test(id))throw Error('无效的账号 ID');return id}
function safeSite(kind){if(typeof kind!=='string'||!Object.hasOwn(SITES,kind))throw Error('该平台尚未配置额度网页');return SITES[kind]}
function urlHost(raw,site,auth=false) {
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&(site.hosts.includes(u.hostname)||(auth&&site.auth.includes(u.hostname)))}catch{return false}
}
function readFile(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function writeFile(file,object){
 const tmp=file+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(object,null,2),{encoding:'utf8',mode:0o600});
 fs.renameSync(tmp,file);
}
function history(id) {
 const list=readFile(historyPath,{});
 return Array.isArray(list[id])?list[id].slice(-1200):[]
}
function record(point) {
 if(!point||!Number.isFinite(point.value)||!['balance','usage','spend'].includes(point.metric))return;
 const all=readFile(historyPath,{});
 const old=Array.isArray(all[point.id])?all[point.id]:[];
 const last=old[old.length-1];
 const now=point.at||new Date().toISOString();
 // Avoid hundreds of duplicate points when a page is static. Keep a heartbeat at most 20 min.
 if(last&&last.value===point.value&&last.unit===point.unit&&last.metric===point.metric&&last.source===point.source&&Date.now()-Date.parse(last.at)<20*60*1000)return;
 old.push({at:now,value:point.value,unit:point.unit,metric:point.metric,source:point.source||'web',limit:Number.isFinite(point.limit)?point.limit:null});
 all[point.id]=old.slice(-1200);
 writeFile(historyPath,all);
}
function normalizeLabel(label) {
 return String(label||'').toLowerCase().replace(/-?\d[\d,]*(?:\.\d+)?\s*(%|usd|cny|元|次|\/)?/g,'').replace(/[^\p{L}]+/gu,'').slice(0,75);
}

function parseDeepSeekAccount(text) {
 const lines=String(text||'').split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
 const money=/([¥￥$])\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(CNY|USD|人民币|美元|元)/i;
 function find(regex){
  for(let i=0;i<lines.length;i++){
   if(!regex.test(lines[i]))continue;
   for(let j=i;j<Math.min(lines.length,i+6);j++){
    const candidate=lines[j];
    if(j>i && /^(?:充值余额|赠送余额|累计消费金额|账户总余额|总可用余额)$/.test(candidate))break;
    const m=candidate.match(money);
    if(!m)continue;
    const n=Number(String(m[2]||m[3]).replace(/,/g,''));
    if(!Number.isFinite(n)||n<0||n>1e9)continue;
    const unit=m[1]==='$'||/USD|美元/i.test(m[4]||'')?'USD':'CNY';
    return {value:n,unit}
   }
  }
  return null
 }
 const topped=find(/^(?:充值余额|可充值余额|Topped[\s-]?up Balance)/i);
 const granted=find(/^(?:赠送余额|赠金余额|Granted Balance)/i);
 const total=find(/^(?:总可用余额|账户总余额|Total Balance)/i);
 const cumulative=find(/^(?:累计消费金额|累计消费|Total Spent)/i);
 if(!total && !(topped && granted))return null;
 if(topped&&granted && topped.unit!==granted.unit)return null;
 const unit=total?.unit||topped?.unit||granted?.unit;
 if(!unit)return null;
 const balance=total?total.value:Math.round((topped.value+granted.value)*1000000)/1000000;
 return {balance,unit,toppedUp:topped?.value??null,granted:granted?.value??null,
   cumulativeSpend:cumulative?.unit===unit?cumulative.value:null}
}

function chatGPTCandidates(text){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
 const found=[];
 const percent=/(\d{1,3}(?:\.\d+)?)\s*%/;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],next=lines[i+1]||'';
  if(/(?:验证码|密码|密钥|cookie|bearer|token|api.key|电子邮箱|@)/i.test(line))continue;
  const relevant=/(?:剩余|可用|remaining|available|已使用|使用量|used|usage)/i.test(line);
  if(!relevant)continue;
  let match=line.match(percent);
  if(!match && next.length<24)match=next.match(percent);
  if(!match)continue;
  const value=Number(match[1]);
  if(!Number.isFinite(value)||value<0||value>100)continue;
  const remaining=/(?:剩余|可用|remaining|available)/i.test(line);
  const type=remaining?'remaining':'used';
  if(found.some(x=>x.signature==='chatgpt:'+type+'_percent'))continue;
  found.push({label:remaining?'ChatGPT 官方页面显示的剩余用量':'ChatGPT 官方页面显示的已使用用量',
   signature:'chatgpt:'+type+'_percent',value,limit:100,unit:'%',
   metric:remaining?'balance':'usage'});
 }
 return found.sort((a,b)=>a.metric==='balance'?-1:b.metric==='balance'?1:0)
}

function deepSeekCandidates(text) {
 const info=parseDeepSeekAccount(text)
 if(!info)return []
 const primary={label:'DeepSeek 账户总可用余额（充值余额 + 赠送余额）',
   signature:'deepseek:total_balance',value:info.balance,limit:null,
   unit:info.unit,metric:'balance',breakdown:info}
 const extras=[]
 if(info.toppedUp!==null)extras.push({label:'DeepSeek 充值余额',signature:'deepseek:topped_up',value:info.toppedUp,limit:null,unit:info.unit,metric:'balance'})
 if(info.granted!==null)extras.push({label:'DeepSeek 赠送余额',signature:'deepseek:granted',value:info.granted,limit:null,unit:info.unit,metric:'balance'})
 if(info.cumulativeSpend!==null)extras.push({label:'DeepSeek 累计消费金额',signature:'deepseek:cumulative_spend',value:info.cumulativeSpend,limit:null,unit:info.unit,metric:'spend'})
 return [primary,...extras]
}

function candidates(text){
 const lines=String(text||'').slice(0,8000).split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
 const signal=/(余额|剩余|可用|额度|消费|费用|使用量|已使用|本月|本周|当前周期|当前会话|限额|请求|积分|balance|remaining|available|usage|used|credits?|spend|cost|weekly|session|monthly|limit|quota)/i;
 const secrets=/(api[\s_-]*key|password|secret|bearer|authorization|sk-[a-z0-9]|cookie|验证码|密钥|密码|token\s*[:=]|令牌|@)/i;
 const found=[];
 for(let i=0;i<lines.length&&found.length<20;i++){
  const line=lines[i];
  if(!signal.test(line)||secrets.test(line))continue;
  const one=line.length>120?line.slice(0,120):line;
  const next=lines[i+1]||'';
  const sample=/[\d¥￥$]/.test(one)?one:next.length<80&&!secrets.test(next)?one+' '+next:one;
  let m=sample.match(/(\d[\d,]*(?:\.\d+)?)\s*\/\s*(\d[\d,]*(?:\.\d+)?)/);
  let value=null,limit=null,unit='次',metric='usage';
  if(m){value=Number(m[1].replace(/,/g,''));limit=Number(m[2].replace(/,/g,''));unit=/token/i.test(one)?'tokens':'次'}
  else if((m=sample.match(/(\d{1,3}(?:\.\d+)?)\s*%/))){
   value=Number(m[1]);limit=100;unit='%';metric=/(余额|剩余|可用|balance|remaining|available)/i.test(one)?'balance':'usage';
  }else if((m=sample.match(/(?:¥|￥|\$|USD|CNY|RMB)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(USD|CNY|元|美元|人民币)/i))){
   value=Number((m[1]||m[2]).replace(/,/g,''));unit=/\$|USD|美元/i.test(m[0])?'USD':'CNY';
   metric=/(费用|消费|花费|spend|cost|已使用)/i.test(one)?'spend':'balance';
  }
  if(value===null||!Number.isFinite(value)||value<0||value>1e10||limit!==null&&(limit<=0||value>limit&&unit==='%'))continue;
  const signature=normalizeLabel(one);
  if(!signature||found.some(x=>x.signature===signature&&x.unit===unit&&x.metric===metric))continue;
  found.push({label:one,signature,value,limit,unit,metric});
 }
 return found;
}
// Use a DOM-derived *visible text excerpt* only. No cookies, headers, passwords, localStorage,
// hidden inputs, browser network interception or site JavaScript globals.
const READ_SCRIPT=[
 '(() => {',
 "const root=document.querySelector('main')||document.querySelector('[role=main]')||document.body;",
 "const raw=(root?.innerText||'').slice(0,18000);",
 "const lines=raw.split(/\\r?\\n/).map(s=>s.trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0,400);",
 "const terms=/(余额|剩余|可用|额度|消费|费用|使用量|已使用|本月|本周|当前周期|当前会话|限额|请求|积分|balance|remaining|available|usage|used|credits?|spend|cost|weekly|session|monthly|limit|quota)/i;",
 "const secret=/(api[ _-]*key|password|secret|bearer|authorization|sk-[a-z0-9]|cookie|验证码|密钥|密码|token\\s*[:=]|令牌|@)/i;",
 "const out=[];",
 "for(let i=0;i<lines.length&&out.length<60;i++){",
 "const s=lines[i];if(!terms.test(s)||secret.test(s))continue;",
 "out.push(s.slice(0,120));",
 "for(let j=1;j<=5&&i+j<lines.length;j++){const next=lines[i+j];if(secret.test(next))continue;if(/(?:\\d{1,3}(?:\\.\\d+)?\\s*%|[¥￥$]\\s*\\d|\\d[\\d,.]*\\s*(?:CNY|USD|元|人民币|美元))/i.test(next)){out.push(next.slice(0,100));break}if(j>1&&/^(?:充值余额|赠送余额|累计消费金额|总可用余额|每周限额)/.test(next))break}",
 "}",
 "return out.join('\\n').slice(0,6000);",
 '})()'
].join('');
function sessionKey(kind,id){return kind+'--'+id}
// One browser page must not be reloaded by a manual refresh and the
// background poll at the same time. A second caller receives the same sample.
const pageRefreshes=new Map();
async function withAccountRefresh(kind,id,action){
 const key=sessionKey(kind,id);
 if(pageRefreshes.has(key))return pageRefreshes.get(key);
 const task=Promise.resolve().then(action);
 pageRefreshes.set(key,task);
 try{return await task}
 finally{if(pageRefreshes.get(key)===task)pageRefreshes.delete(key)}
}
const autoChecking=new Set();
const autoTimers=new Map();
async function autoLinkDeepSeek(kind,id,win){
 if(!['deepseek','chatgpt'].includes(kind)||shuttingDown||autoChecking.has(id)||win.isDestroyed())return;
 if(readFile(bindingsPath,{})[id]){
  const t=autoTimers.get(id);if(t){clearInterval(t);autoTimers.delete(id)}
  return;
 }
 autoChecking.add(id);
 try{
  const data=await read(kind,id);
  const selected=data.candidates.find(c=>kind==='deepseek'?
   c.signature==='deepseek:total_balance':
   c.signature==='chatgpt:remaining_percent')
   || (kind==='chatgpt'?data.candidates.find(c=>c.signature==='chatgpt:used_percent'):undefined)
  if(!selected)return;
  const cfg=readFile(bindingsPath,{});
  if(cfg[id])return;
  cfg[id]={kind,signature:selected.signature,unit:selected.unit,metric:selected.metric,
   label:selected.label,name:kind==='chatgpt'?'ChatGPT':'DeepSeek API',autoLinked:true};
  writeFile(bindingsPath,cfg);
  const point=await withAccountRefresh(kind,id,()=>sample(kind,id,true));
  if(!point)throw Error('首次余额同步失败');
  notify({type:'linked',point,provider:{id,kind,name:kind==='chatgpt'?'ChatGPT':'DeepSeek API',
   category:kind==='chatgpt'?'订阅':'API',
   metric:point.metric,unit:point.unit,value:point.value,source:'web',
   webMonitored:true,connected:false,updatedAt:point.at}});
  const t=autoTimers.get(id);if(t){clearInterval(t);autoTimers.delete(id)}
  // The account has been linked: return focus to the QuotaHub dashboard.
  if(!win.isDestroyed())win.hide();
 }catch(err){
  // Authentication may not be complete yet. Retry after the user finishes login.
  if(process.env.AIQUOTA_DIAGNOSTICS==='1')console.warn('DeepSeek automatic binding pending:',String(err.message||err).slice(0,130));
 }finally{autoChecking.delete(id)}
}

function open(kind,id,visible=true) {
 safeId(id);const site=safeSite(kind);
 const key=sessionKey(kind,id);
 let win=windows.get(key);
 if(win&&!win.isDestroyed()){if(visible){win.show();win.focus()}return {url:win.webContents.getURL()||site.url}}
 // Persistent isolated Chromium profile for voluntary "remember login" in local userData.
 // The app never reads its cookies; user may remove it by deleting the binding.
 win=new BrowserWindow({
  width:1130,height:800,minWidth:830,minHeight:590,show:false,autoHideMenuBar:true,
  title:'QuotaHub · '+kind+' 官方额度页面',backgroundColor:'#ffffff',
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,
    partition:'persist:quota-browser-'+key,backgroundThrottling:false}
 });
 windows.set(key,win);
 const ses=win.webContents.session;
 ses.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 ses.on('will-download',event=>event.preventDefault());
 // No local downloads or opening unknown browser windows.
 win.webContents.setWindowOpenHandler(({url})=>{
  if(urlHost(url,site,true))void shell.openExternal(url).catch(()=>{});
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(!urlHost(url,site,true))event.preventDefault()});
 win.on('close',event=>{
  if(!shuttingDown && readFile(bindingsPath,{})[id]){
   event.preventDefault();
   win.hide();
  }
 });
 win.on('closed',()=>{
  windows.delete(key);
  const t=autoTimers.get(id);if(t){clearInterval(t);autoTimers.delete(id)}
 });
 if(['deepseek','chatgpt'].includes(kind)&&!readFile(bindingsPath,{})[id]){
  const probe=()=>void autoLinkDeepSeek(kind,id,win);
  win.webContents.on('did-finish-load',()=>setTimeout(probe,2000).unref?.());
  win.webContents.on('did-navigate-in-page',()=>setTimeout(probe,1800).unref?.());
  const t=setInterval(probe,8000);t.unref?.();autoTimers.set(id,t);
 }
 win.once('ready-to-show',()=>{if(visible)win.show()});
 void win.loadURL(site.url).catch(err=>{console.warn('Official usage page load:',kind,err.message);if(!win.isDestroyed())win.show()});
 return {url:site.url};
}
async function read(kind,id) {
 safeId(id);const site=safeSite(kind);
 const win=windows.get(sessionKey(kind,id));
 if(!win||win.isDestroyed())throw Error('请先打开该账户的官方额度网页并登录');
 const url=win.webContents.getURL();
 if(!urlHost(url,site))throw Error('当前不是受支持的额度页面，请完成登录后返回官网');
 if(win.webContents.isLoadingMainFrame())throw Error('页面加载中，请稍后重试');
 const text=await win.webContents.executeJavaScriptInIsolatedWorld(1025,[{code:READ_SCRIPT}],false);
 if(typeof text!=='string'||!text.trim())throw Error('未识别到页面中的额度文字，请切换到官方额度页面');
 const found=kind==='deepseek' ? [...deepSeekCandidates(text),...candidates(text)] : kind==='chatgpt' ? [...chatGPTCandidates(text),...candidates(text)] : candidates(text);
 if(!found.length)throw Error('没有发现可核对的额度数值，请检查页面内容和登录状态');
 return {candidates:found,readAt:new Date().toISOString(),url:new URL(url).origin+new URL(url).pathname};
}
async function sample(kind,id,manual=false) {
 const records=readFile(bindingsPath,{});
 const binding=records[id];
 if(!binding||binding.kind!==kind)return null;
 const web=await read(kind,id);
 // A slight change to a label is okay, but a different metric/unit is not.
 const found=web.candidates.find(c=>c.signature===binding.signature&&c.unit===binding.unit&&c.metric===binding.metric);
 if(!found)throw Error('额度页面结构发生变化，需要重新选择要跟踪的指标');
 const point={id,kind,value:found.value,limit:found.limit??null,unit:found.unit,metric:found.metric,
   at:new Date().toISOString(),source:'web',readAt:web.readAt,
   ...(found.breakdown?{breakdown:found.breakdown}:{})};
 record(point);
 notify({type:'snapshot',point,manual});
 return point;
}
async function bind(kind,id,candidate) {
 safeId(id);safeSite(kind);
 if(!candidate||typeof candidate!=='object'||typeof candidate.signature!=='string')throw Error('请选择额度指标');
 const seen=await read(kind,id);
 const found=seen.candidates.find(c=>c.signature===candidate.signature&&c.unit===candidate.unit&&c.metric===candidate.metric);
 if(!found)throw Error('选中的指标已变化，请重新获取页面数据');
 const bindings=readFile(bindingsPath,{});
 bindings[id]={kind,signature:found.signature,unit:found.unit,metric:found.metric,label:found.label.slice(0,120)};
 writeFile(bindingsPath,bindings);
 return withAccountRefresh(kind,id,()=>sample(kind,id,true));
}
async function unbind(id) {
 safeId(id);
 const bindings=readFile(bindingsPath,{});
 const kind=bindings[id]?.kind;
 delete bindings[id];
 writeFile(bindingsPath,bindings);
 if(kind){
  const key=sessionKey(kind,id);
  const win=windows.get(key);
  if(win&&!win.isDestroyed())win.destroy();
  windows.delete(key);
  // Clear the isolated login session associated with this account.
  const {session}=require('electron');
  try{await session.fromPartition('persist:quota-browser-'+key).clearStorageData()}catch{}
 }
 return true;
}
let pollInFlight=null;
async function pollAll() {
 if(pollInFlight)return pollInFlight;
 pollInFlight=(async()=>{
 const bindings=readFile(bindingsPath,{});
 for(const [id,binding] of Object.entries(bindings)){
  const win=windows.get(sessionKey(binding.kind,id));
  if(!win||win.isDestroyed()||win.webContents.isLoadingMainFrame())continue;
  try{
   await withAccountRefresh(binding.kind,id,async()=>{
   // Refresh live usage dashboards while the website window is hidden.
   // Without this, some SPA dashboards show a stale number indefinitely.
   // Never interrupt a site the user is actively interacting with.
   if(['deepseek','chatgpt'].includes(binding.kind) && !win.isVisible?.()
      && typeof win.webContents.reloadIgnoringCache==='function'){
    await new Promise(resolve=>{
     let finished=false;
     const done=()=>{
      if(finished)return;
      finished=true;clearTimeout(timeout);
      win.webContents.removeListener?.('did-finish-load',done);
      resolve();
     };
     const timeout=setTimeout(done,16000);
     win.webContents.once('did-finish-load',done);
     try{win.webContents.reloadIgnoringCache()}catch{done()}
    });
    await new Promise(r=>setTimeout(r,1800));
   }
   let completed=false;
   for(let attempt=0;attempt<3&&!completed;attempt++){
    try{await sample(binding.kind,id);completed=true}
    catch(err){
     if(attempt===2)throw err;
     await new Promise(r=>setTimeout(r,1800));
    }
   }
   });
  }catch(err){notify({type:'stale',id,reason:String(err.message||'网页数据暂不可用').slice(0,160)})}
 }
 })();
 try{return await pollInFlight}
 finally{pollInFlight=null}
}
function flushPersistentSessions(){
  for(const win of windows.values()){
    if(win.isDestroyed())continue;
    try{win.webContents.session.flushStorageData()}catch(error){
      console.warn('QuotaHub session flush:',String(error.message||error).slice(0,120));
    }
  }
}
function sessionStatus(){
 return Array.from(windows.entries()).map(([key,win])=>({
  account:key.split('--').slice(1).join('--'),platform:key.split('--')[0],
  loaded:!win.isDestroyed()&&!win.webContents.isLoadingMainFrame(),
  sessionPersistent:!win.isDestroyed()&&Boolean(win.webContents.session.isPersistent?.()),
  // No cookies, credentials, URLs, or login data are returned.
 }))
}
function register({dir,onUpdate}){
 dataPath=dir;
 bindingsPath=path.join(dir,'quota-web-bindings.json');
 historyPath=path.join(dir,'quota-history.json');
 notify=onUpdate;
 ipcMain.handle('quota:webOpen',(_e,kind,id)=>open(kind,id));
 ipcMain.handle('quota:webRead',(_e,kind,id)=>read(kind,id));
 ipcMain.handle('quota:webBind',(_e,kind,id,choice)=>bind(kind,id,choice));
 ipcMain.handle('quota:webSample',(_e,kind,id)=>withAccountRefresh(kind,id,async()=>{
  // A user-initiated Refresh must request the latest official usage page,
  // not only reread an outdated hidden SPA DOM.
  const win=windows.get(sessionKey(kind,id));
  if(['deepseek','chatgpt'].includes(kind) && win&&!win.isDestroyed()
     && !win.isVisible?.() && typeof win.webContents.reloadIgnoringCache==='function'){
   await new Promise(resolve=>{
    let done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(timeout);
      win.webContents.removeListener?.('did-finish-load',finish);resolve()};
    const timeout=setTimeout(finish,12000);
    win.webContents.once?.('did-finish-load',finish);
    try{win.webContents.reloadIgnoringCache()}catch{finish()}
   });
   await new Promise(resolve=>setTimeout(resolve,1200));
  }
  return sample(kind,id,true);
 }));
 ipcMain.handle('quota:webUnbind',(_e,id)=>unbind(id));
 ipcMain.handle('quota:webBindings',()=>{
  const all=readFile(bindingsPath,{});
  const answer={};
  for(const [id,entry] of Object.entries(all)){
   const last=history(id).at(-1);
   answer[id]={...entry,last:last?{value:last.value,at:last.at,unit:last.unit,metric:last.metric}:null};
  }
  return answer;
 });
 ipcMain.handle('quota:history',(_e,id)=>history(safeId(id)));
 ipcMain.handle('quota:historyRecord',(_e,point)=>{
  safeId(point?.id);
  if(point.source!=='manual'&&point.source!=='api')throw Error('未授权的采样来源');
  record({...point,at:new Date().toISOString()});return true;
 });
 // The usage website stays in a dedicated session, never accessed with passwords/API keys.
 // Previously authorized accounts resume in background after restart, using their
 // isolated on-disk website session. New login may be needed if site expired.
 const saved=readFile(bindingsPath,{});
 for(const [id,entry] of Object.entries(saved)){
  try{open(entry.kind,id,false)}catch{}
 }
 // Recover the pre-existing logged-in DeepSeek browser even if the user only
 // clicked "Open official page" and never saved the binding dialog.
 try {
  const partitions=path.join(dir,'Partitions');
  for(const item of fs.readdirSync(partitions,{withFileTypes:true})){
   if(!item.isDirectory())continue;
   const match=/^quota-browser-(deepseek|chatgpt)--([a-z0-9][a-z0-9_-]{1,100})$/i.exec(item.name);
   if(!match||saved[match[2]])continue;
   open(match[1],match[2],false);
  }
 }catch{}

 setTimeout(()=>void pollAll(),12000).unref?.();
 timer=setInterval(()=>void pollAll(),90000);
 timer.unref?.();
 // Chromium owns its login-state stores. Flush pending DOMStorage periodically
 // even while the quota UI/window is hidden; on Windows shutdown before-quit
 // may not fire, so periodic flush is important.
 flushTimer=setInterval(flushPersistentSessions,60000);
 flushTimer.unref?.();
}
function hasBinding(id){return !!readFile(bindingsPath, {})[id]}
function shutdown(){
 flushPersistentSessions();
 shuttingDown=true;
 if(timer)clearInterval(timer);
 if(flushTimer)clearInterval(flushTimer);
 for(const t of autoTimers.values())clearInterval(t);
 autoTimers.clear();
 for(const win of windows.values())if(!win.isDestroyed())win.destroy();
 windows.clear();
}
module.exports={register,shutdown,flushPersistentSessions,sessionStatus,hasBinding,pollAll,candidates,deepSeekCandidates,chatGPTCandidates,parseDeepSeekAccount,normalizeLabel,record,read,bind,open,autoLinkDeepSeek,_testWindows:windows};
