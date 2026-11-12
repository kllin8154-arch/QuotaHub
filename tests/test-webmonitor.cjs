'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const os=require('node:os')
const Module=require('node:module')
const EventEmitter=require('node:events')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quota-web-qa-'))
const handlers=new Map()
let visible='本周已使用\n35%\n账户余额\n¥26.80\nResets in 2 hours'
const mockSession={setPermissionRequestHandler:()=>{},on:()=>{},clearStorageData:async()=>{}}
class FakeWindow extends EventEmitter {
 constructor(opts){super();this.opts=opts;this.destroyed=false;this.shown=false;this.url='';
  this.webContents=new EventEmitter();
  this.webContents.session=mockSession;
  this.webContents.setWindowOpenHandler=()=>{};
  this.webContents.getURL=()=>this.url;
  this.webContents.isLoadingMainFrame=()=>false;
  this.webContents.executeJavaScriptInIsolatedWorld=async (_world, scripts)=>{
   assert(scripts[0].code.includes('innerText'))
   assert(!scripts[0].code.includes('document.cookie'))
   return visible
  }
 }
 async loadURL(url){this.url=url;this.emit('ready-to-show')}
 show(){this.shown=true}
 hide(){this.shown=false}
 focus(){}
 isDestroyed(){return this.destroyed}
 destroy(){this.destroyed=true;this.emit('closed')}
}
const electronMock={BrowserWindow:FakeWindow,ipcMain:{handle:(name,cb)=>handlers.set(name,cb)},shell:{openExternal:async()=>{}},session:{fromPartition:()=>mockSession}}
const orig=Module._load
Module._load=function(id,parent,main){if(id==='electron')return electronMock;return orig.apply(this,arguments)}
const monitor=require('../electron/webQuota.cjs')
Module._load=orig
const updates=[]
monitor.register({dir:tmp,onUpdate:msg=>updates.push(msg)})
const id='qh-web-01'
async function main(){
 const candidate=monitor.candidates('本周已使用\n35%\n账户余额\n¥26.80\n')
 assert(candidate.some(x=>x.unit==='%'&&x.value===35))
 assert(candidate.some(x=>x.unit==='CNY'&&x.value===26.8))
 await handlers.get('quota:webOpen')(null,'chatgpt',id)
 const initial=await handlers.get('quota:webRead')(null,'chatgpt',id)
 assert(initial.candidates.some(x=>x.value===35))
 const chosen=initial.candidates.find(x=>x.unit==='%')
 const registered=await handlers.get('quota:webBind')(null,'chatgpt',id,chosen)
 assert.equal(registered.value,35)
 assert.equal(registered.resetAt,null,'ChatGPT no longer fabricates a universal reset from an unlabeled timer')
 assert.deepEqual(registered.quotaWindows,[],'No recognized 5-hour/weekly sections means no windows')
 assert.equal(updates.length,1)
 assert.equal((await handlers.get('quota:history')(null,id)).length,1)
 // The same value is deduplicated, no fake high-frequency trend points.
 await handlers.get('quota:webSample')(null,'chatgpt',id)
 assert.equal((await handlers.get('quota:history')(null,id)).length,1)
 visible='本周已使用\n48%\n账户余额\n¥26.80\nResets in 3 hours'
 await monitor.pollAll()
 const rows=await handlers.get('quota:history')(null,id)
 assert.equal(rows.length,2)
 assert.deepEqual(rows.map(x=>x.value),[35,48])
 assert.equal(rows[1].source,'web')
 const afterReset=(await handlers.get('quota:webBindings')())[id]
 assert.equal(afterReset.resetAt,null,'A generic reset remains unverified for ChatGPT')
 assert(rows[1].at && Number.isFinite(Date.parse(rows[1].at)))
 const bindings=await handlers.get('quota:webBindings')()
 assert(bindings[id]?.signature===chosen.signature)
 visible='今日消费\n¥3.60'
 await monitor.pollAll()
 assert(updates.some(x=>x.type==='stale'))
 assert.equal((await handlers.get('quota:history')(null,id)).length,2)
 // A manual user refresh and two scheduled polls must share ONE website read.
 visible='本周已使用\n49%\n账户余额\n¥26.80'
 const browser=monitor._testWindows.get('chatgpt--'+id)
 const originalRead=browser.webContents.executeJavaScriptInIsolatedWorld
 let releaseRead,actualReads=0
 const gate=new Promise(resolve=>{releaseRead=resolve})
 browser.webContents.executeJavaScriptInIsolatedWorld=async(...args)=>{
  actualReads++
  await gate
  return originalRead(...args)
 }
 // Backoff skips background retries after failure; explicit user refresh bypasses it.
 const pending=[
  handlers.get('quota:webSample')(null,'chatgpt',id),
  monitor.pollAll(),monitor.pollAll()
 ]
 await new Promise(r=>setTimeout(r,30))
 assert.equal(actualReads,1,'concurrent manual/automatic refresh must share one official website read')
 releaseRead()
 await Promise.all(pending)
 browser.webContents.executeJavaScriptInIsolatedWorld=originalRead
 const finalHistory=await handlers.get('quota:history')(null,id)
 assert.deepEqual(finalHistory.map(x=>x.value),[35,48,49])
 assert.equal(updates.filter(x=>x.type==='snapshot'&&x.point.value===49).length,1,'one actual sample must not be duplicated')
 // Actual Codex usage has two unrelated allowance windows; a unified reset must never be inferred.
 visible='本周已使用\n49%\n账户余额\n¥26.80\n5 小时限额\n3小时34分钟 后重置\n剩余 0%\n每周限额\n6天22小时 后重置\n剩余 84%\n当前套餐\nPlus'
 const twoWindows=await handlers.get('quota:webSample')(null,'chatgpt',id)
 assert.equal(twoWindows.resetAt,null)
 assert.deepEqual(twoWindows.quotaWindows.map(w=>[w.id,w.remainingPercent]),[['five-hour',0],['weekly',84]])
 assert.equal(twoWindows.planTier,'Plus')
 const savedWindows=(await handlers.get('quota:webBindings')())[id]
 assert.equal(savedWindows.quotaWindows.length,2,'Window metadata persists when main usage value is unchanged')
 assert.equal(savedWindows.planTier,'Plus')
 assert.equal((await handlers.get('quota:history')(null,id)).length,3,'Two windows must not create synthetic sampling history')
 await handlers.get('quota:webUnbind')(null,id)
 assert(!(await handlers.get('quota:webBindings')())[id])
 assert.equal((await handlers.get('quota:history')(null,id)).length,3,'Historical data preserved on disconnect')
 monitor.shutdown()
 console.log('PASS: isolated website, 35->48->49 sample history, dedup, overlapping manual/scheduled poll lock, stale detection; QA only.')
}
main().catch(err=>{monitor.shutdown();console.error(err);process.exitCode=1}).finally(()=>fs.rmSync(tmp,{recursive:true,force:true}))

