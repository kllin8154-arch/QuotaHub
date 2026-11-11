'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const Module=require('node:module')
const EventEmitter=require('node:events')
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'quota-auto-'))
const ipc=new Map()
let pageText='用量信息\n充值余额\n余额预警已开启 去设置\n¥1.88 CNY\n去充值\n累计消费金额\n¥432.28 CNY\n赠送余额\n¥6.40 CNY\n近 30 天\n消费金额\n¥4.75 CNY\nAPI 请求次数\n338'
const mockSession={setPermissionRequestHandler:()=>{},on:()=>{},clearStorageData:async()=>{},flushStorageData:()=>{}}
class MockWindow extends EventEmitter {
 constructor(){super();this.destroyed=false;this.shown=false;this.location=''
  this.webContents=new EventEmitter()
  this.webContents.session=mockSession
  this.webContents.setWindowOpenHandler=()=>{}
  this.webContents.getURL=()=>this.location
  this.webContents.isLoadingMainFrame=()=>false
  this.webContents.executeJavaScriptInIsolatedWorld=async()=>pageText
 }
 loadURL(url){this.location=url;this.emit('ready-to-show');return Promise.resolve()}
 show(){this.shown=true}
 hide(){this.shown=false}
 focus(){}
 isDestroyed(){return this.destroyed}
 destroy(){this.destroyed=true;this.emit('closed')}
}
const electron={BrowserWindow:MockWindow,ipcMain:{handle:(id,handler)=>ipc.set(id,handler)},shell:{openExternal:async()=>{}},session:{fromPartition:()=>mockSession}}
const original=Module._load
Module._load=function(id,parent,main){if(id==='electron')return electron;return original.apply(this,arguments)}
const mod=require('../electron/webQuota.cjs')
Module._load=original
const received=[]
async function main(){
 mod.register({dir:temp,onUpdate:event=>received.push(event)})
 const obj=mod.parseDeepSeekAccount(pageText)
 assert.deepEqual(obj,{balance:8.28,unit:'CNY',toppedUp:1.88,granted:6.4,cumulativeSpend:432.28})
 const id='qh-test-deepseek'
 mod.open('deepseek',id,true)
 // Re-use the UI's real internal event: this is what fires when the website renders.
 const binding=await ipc.get('quota:webRead')(null,'deepseek',id)
 assert(binding.candidates[0].signature==='deepseek:total_balance')
 assert.equal(binding.candidates[0].value,8.28)
 // Test automatic first binding without clicking Save.
 const win=mod._testWindows.get('deepseek--'+id)
 await mod.autoLinkDeepSeek('deepseek',id,win)
 const linked=received.find(x=>x.type==='linked')
 assert(linked)
 assert.equal(linked.point.value,8.28)
 assert.equal(linked.provider.name,'DeepSeek API')
 assert.equal((await ipc.get('quota:history')(null,id)).length,1)
 assert.equal((await ipc.get('quota:webBindings')())[id].signature,'deepseek:total_balance')
 pageText='用量信息\n充值余额\n¥1.20 CNY\n累计消费金额\n¥432.96 CNY\n赠送余额\n¥6.40 CNY'
 await mod.pollAll()
 const rows=await ipc.get('quota:history')(null,id)
 assert.equal(rows.length,2)
 assert.equal(rows[1].value,7.6)
 await mod.pollAll()
 assert.equal((await ipc.get('quota:history')(null,id)).length,2)
 mod.shutdown()
 console.log('DEEPSEEK_AUTO_LINK_TEST_PASS: login page -> auto bind -> 8.28 CNY -> 7.60 CNY, no user API Key.')
}
main().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>{mod.shutdown();fs.rmSync(temp,{recursive:true,force:true})})
