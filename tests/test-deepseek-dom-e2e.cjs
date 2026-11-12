'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const Module=require('node:module')
const EventEmitter=require('node:events')
const root=path.join(__dirname,'..')
const temp=path.join(root,'.qa','deepseek-end-to-end-fixture')
fs.mkdirSync(temp,{recursive:true})
const handlers=new Map()
let visible='用量信息\n充值余额 余额预警已开启 去设置\n¥1.88 CNY\n累计消费金额\n¥432.28 CNY\n赠送余额\n¥6.40 CNY\n消费金额\n¥3.93 CNY'
const mockSession={setPermissionRequestHandler:()=>{},on:()=>{},clearStorageData:async()=>{},flushStorageData:()=>{}}
class FakeWindow extends EventEmitter{
 constructor(){
  super();this.closed=false;this.url='';this.shown=false;this.webContents=new EventEmitter()
  this.webContents.session=mockSession
  this.webContents.getURL=()=>this.url
  this.webContents.isLoadingMainFrame=()=>false
  this.webContents.setWindowOpenHandler=()=>{}
  this.webContents.executeJavaScriptInIsolatedWorld=async(_world,scripts)=>{
   const document={querySelector:()=>({innerText:visible}),body:{innerText:visible}}
   return vm.runInNewContext(scripts[0].code,{document})
  }
 }
 async loadURL(url){this.url=url;this.emit('ready-to-show')}
 show(){this.shown=true}hide(){this.shown=false}focus(){}
 isVisible(){return this.shown}
 isDestroyed(){return this.closed}
 destroy(){this.closed=true;this.emit('closed')}
}
const mock={BrowserWindow:FakeWindow,ipcMain:{handle:(name,callback)=>handlers.set(name,callback)},shell:{openExternal:async()=>{}},session:{fromPartition:()=>mockSession}}
const orig=Module._load
Module._load=function(name,parent,main){if(name==='electron')return mock;return orig.apply(this,arguments)}
const monitor=require('../electron/webQuota.cjs')
Module._load=orig
const id='qa-deepseek-dom'
const updates=[]
async function test(){
 const record=await handlers.get('quota:webOpen')(null,'deepseek',id)
 assert.equal(record.url,'https://platform.deepseek.com/usage')
 const result=await handlers.get('quota:webRead')(null,'deepseek',id)
 const total=result.candidates.find(x=>x.signature==='deepseek:total_balance')
 assert(total,'DeepSeek official visible balance missed')
 assert.equal(total.value,8.28)
 assert.equal(total.breakdown?.toppedUp,1.88)
 assert.equal(total.breakdown?.granted,6.4)
 assert.equal(total.breakdown?.cumulativeSpend,432.28)
 const first=await handlers.get('quota:webBind')(null,'deepseek',id,total)
 assert.equal(first.value,8.28)
 assert.equal((await handlers.get('quota:history')(null,id)).length,1)
 visible=visible.replace('¥1.88','¥1.87')
 const second=await handlers.get('quota:webSample')(null,'deepseek',id)
 assert.equal(second.value,8.27,'Changes in recharge balance should update without reauthorizing')
 const history=await handlers.get('quota:history')(null,id)
 assert.deepEqual(history.map(x=>x.value),[8.28,8.27])
 visible='充值余额\n暂无额度'
 await assert.rejects(handlers.get('quota:webSample')(null,'deepseek',id),/QUOTA_PARSE_NO_VALUE/,'Do not misclassify official page parse errors as expired authentication')
 visible='充值余额\n¥1.86 CNY\n赠送余额\n¥6.40 CNY'
 const recovered=await handlers.get('quota:webSample')(null,'deepseek',id)
 assert.equal(recovered.value,8.26,'Reuses existing account session and recovers automatically')
 assert.equal(updates.filter(x=>x.type==='snapshot').length,3)
 await handlers.get('quota:webUnbind')(null,id)
 monitor.shutdown()
 console.log('DEEPSEEK_EXISTING_WEB_SESSION_8_28_TO_8_27_TO_8_26_RECOVERY_PASS')
}
monitor.register({dir:temp,onUpdate:msg=>updates.push(msg)})
test().catch(err=>{monitor.shutdown();console.error(err);process.exitCode=1}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}))
