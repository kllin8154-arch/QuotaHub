'use strict'

// Explicit user actions must finish the Electron process, even when hidden,
// authenticated BrowserWindows would otherwise veto a regular close event.
// Wait briefly for Chromium's persistent session flush before app.exit().
function createQuitController({app,flush,shutdown,cancel,windows,destroyTray,onBegin,timeoutMs=2500}){
 let pending=null
 function requestExit({restart=false}={}){
  if(pending)return pending
  pending=(async()=>{
   try{onBegin?.()}catch{}
   try{cancel?.()}catch{}
   let timeout
   try{
    await Promise.race([
     Promise.resolve().then(()=>flush?.()).catch(()=>{}),
     new Promise(resolve=>{timeout=setTimeout(resolve,timeoutMs)})
    ])
   }catch{}
   finally{clearTimeout(timeout)}
   try{shutdown?.()}catch{}
   try{
    for(const win of windows?.()||[])if(!win.isDestroyed?.())win.destroy?.()
   }catch{}
   try{destroyTray?.()}catch{}
   if(restart)try{app.relaunch()}catch{}
   app.exit(0)
  })()
  return pending
 }
 return {requestExit}
}
module.exports={createQuitController}
