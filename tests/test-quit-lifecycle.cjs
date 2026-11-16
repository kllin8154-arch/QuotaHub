'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {createQuitController}=require('../electron/quitControl.cjs')
const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8')
assert(!source.includes('allowQuit'),'Unused fake exit state must be removed')
assert(source.includes("label:'退出 Agnovexa One',click:()=>{void requestExit()}"))
assert.equal(source.split("label:'退出 Agnovexa One',click:()=>{void requestExit()}").length-1,2,
 'Both native menus must route to the same full-exit action')
assert(source.includes("label:'重新启动 Agnovexa One',click:()=>{void requestExit({restart:true})}"))
assert(source.includes("if(argv.includes('--quit-existing')){void requestExit();return}"))
assert(source.includes("if(process.argv.includes('--quit-existing')){void requestExit();return}"),
 'Late quit requester must exit even if it wins the single-instance lock')
assert(source.includes("if(!explicitlyExiting&&process.platform!=='darwin')app.quit()"))
const web=fs.readFileSync(path.join(__dirname,'../electron/webQuota.cjs'),'utf8')
assert(web.includes('return Promise.allSettled(pending)'), 'Actual Chromium session flush must be awaitable')
function mock(extra={}){
 const calls=[]
 const app={
  exit(code){calls.push('exit:'+code)},
  relaunch(){calls.push('relaunch')}
 }
 const win={isDestroyed:()=>false,destroy(){calls.push('window:destroy')}}
 const {requestExit}=createQuitController({
  app,flush:extra.flush||(()=>{calls.push('flush');return Promise.resolve()}),
  cancel:()=>calls.push('cancel'),
  shutdown:()=>calls.push('shutdown'),windows:()=>[win],
  destroyTray:()=>calls.push('tray:destroy'),
  onBegin:()=>calls.push('begin'),timeoutMs:extra.timeoutMs||150
 })
 return {requestExit,calls}
}
async function main(){
 const a=mock()
 const p1=a.requestExit(),p2=a.requestExit()
 assert.strictEqual(p1,p2,'Multiple exit clicks must not run two shutdowns')
 await p1
 assert.deepEqual(a.calls,['begin','cancel','flush','shutdown','window:destroy','tray:destroy','exit:0'])
 assert(!a.calls.includes('relaunch'),'Exit must never restart')
 const b=mock()
 await b.requestExit({restart:true})
 assert.equal(b.calls.filter(x=>x==='relaunch').length,1)
 assert.equal(b.calls.at(-1),'exit:0')
 assert(b.calls.indexOf('relaunch')>b.calls.indexOf('shutdown'))
 const c=mock({flush:()=>new Promise(()=>{}),timeoutMs:25})
 const started=Date.now()
 await c.requestExit()
 assert(Date.now()-started<650,'A hung Chromium flush must not block exit forever')
 assert.equal(c.calls.at(-1),'exit:0')
 const d=mock({flush:()=>Promise.reject(new Error('synthetic closed session'))})
 await d.requestExit()
 assert.equal(d.calls.at(-1),'exit:0')
 console.log('NATIVE_WIDGET_TRAY_EXIT_IDEMPOTENT_GRACEFUL_FLUSH_AND_RESTART_PASS')
}
main().catch(e=>{console.error(e);process.exitCode=1})
