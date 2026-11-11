'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const Module=require('node:module')
const EventEmitter=require('node:events')
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quota-chatgpt-autolink-'))
const handlers=new Map()
let page='使用情况\n当前周期\n剩余 100%\n每周限额\n剩余 100%\n最近重置 18:00'
const session={setPermissionRequestHandler:()=>{},on:()=>{},clearStorageData:async()=>{},flushStorageData:()=>{}}
class Win extends EventEmitter {
 constructor(){super();this.destroyed=false;this.url='';this.shown=false;
  this.webContents=new EventEmitter()
  this.webContents.session=session
  this.webContents.setWindowOpenHandler=()=>{}
  this.webContents.getURL=()=>this.url
  this.webContents.isLoadingMainFrame=()=>false
  this.webContents.executeJavaScriptInIsolatedWorld=async()=>page
 }
 loadURL(url){this.url=url;this.emit('ready-to-show');return Promise.resolve()}
 show(){this.shown=true}
 focus(){}
 hide(){this.shown=false}
 isVisible(){return this.shown}
 isDestroyed(){return this.destroyed}
 destroy(){this.destroyed=true;this.emit('closed')}
}
const fake={BrowserWindow:Win,ipcMain:{handle:(name,cb)=>handlers.set(name,cb)},shell:{openExternal:async()=>{}},session:{fromPartition:()=>session}}
const load=Module._load
Module._load=function(name,parent,main){if(name==='electron')return fake;return load.apply(this,arguments)}
const monitor=require('../electron/webQuota.cjs')
Module._load=load
const events=[]
async function run(){
 monitor.register({dir,onUpdate:(e)=>events.push(e)})
 const id='qh-chatgpt-test'
 monitor.open('chatgpt',id,true)
 const win=monitor._testWindows.get('chatgpt--'+id)
 const options=await handlers.get('quota:webRead')(null,'chatgpt',id)
 assert(options.candidates.some(c=>c.signature==='chatgpt:remaining_percent'&&c.value===100))
 await monitor.autoLinkDeepSeek('chatgpt',id,win)
 const linked=events.find(e=>e.type==='linked')
 assert(linked)
 assert.equal(linked.provider.name,'ChatGPT')
 assert.equal(linked.point.metric,'balance')
 assert.equal(linked.point.unit,'%')
 assert.equal(linked.point.value,100)
 assert.equal(win.shown,false)
 assert.equal((await handlers.get('quota:history')(null,id)).length,1)
 page='使用情况\n当前周期\n剩余 93%\n每周限额\n剩余 100%'
 await monitor.pollAll()
 const list=await handlers.get('quota:history')(null,id)
 assert.deepEqual(list.map(x=>x.value),[100,93])
 const bindings=await handlers.get('quota:webBindings')()
 assert.equal(bindings[id].signature,'chatgpt:remaining_percent')
 await monitor.pollAll()
 assert.equal((await handlers.get('quota:history')(null,id)).length,2)
 console.log('CHATGPT_LOGIN_ONLY_AUTO_LINK_PASS: 100% -> 93%, history, widget-linked event, no manual save.')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{monitor.shutdown();fs.rmSync(dir,{recursive:true,force:true})})
