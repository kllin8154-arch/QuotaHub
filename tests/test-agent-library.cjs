'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const path=require('node:path')
const root=path.join(__dirname,'..')
const code=fs.readFileSync(path.join(root,'src/agentCatalog.ts'),'utf8')
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const out={}
vm.runInNewContext(js,{exports:out})
const {agentCatalog,agentSearch}=out
assert(agentCatalog.length>=15)
assert.equal(new Set(agentCatalog.map(x=>x.id)).size,agentCatalog.length)
for(const name of ['OpenCode','WorkBuddy','Codex CLI','Claude Code','Gemini CLI','Cline','Roo Code','Kilo Code','Cursor']){
 assert(agentCatalog.some(x=>x.name===name),name+' catalog entry missing')
}
for(const item of agentCatalog){
 assert(/^https:\/\//.test(item.url)&&!item.url.includes('@'),item.id+' URL must use verified official HTTPS domain')
 assert(item.providerHints.length>=1,item.id+' provider mapping missing')
 assert(['API Key / 账号','官方账号 / 订阅','底层模型 API Key'].includes(item.auth))
 assert(['subscription','provider'].includes(item.connection))
}
assert.deepEqual(Array.from(agentCatalog.filter(x=>agentSearch(x,'workbuddy')).map(x=>x.id)),['workbuddy'])
assert.deepEqual(Array.from(agentCatalog.filter(x=>agentSearch(x,'opencode')).map(x=>x.id)),['opencode'])
assert(agentCatalog.filter(x=>agentSearch(x,'vscode')).length>=2)
assert(agentCatalog.filter(x=>agentSearch(x,'不存在的服务')).length===0)
const lib=fs.readFileSync(path.join(root,'src/PlatformLibrary.tsx'),'utf8')
assert(lib.includes('onProvider(kind)')&&lib.includes('agentSearch(a,term)')&&lib.includes('type="search"'))
assert(lib.includes('智能体工具')&&lib.includes('额度服务'))
assert(lib.includes('model')===false||lib.includes('agent'), 'catalog must distinguish agent and provider')
assert(!/type="password"|session\.fromPartition|fs\.readFileSync/.test(lib),'catalog must not collect credentials')
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8')
assert(app.includes('setLibraryOpen(true)')&&app.includes('<PlatformLibrary'))
assert(!app.includes('下次重置日期（可选）'),'manual reset field removed')
assert(app.includes('quotaResetLabel(detailProvider,now)'))
assert(app.includes('resetAt:p.resetAt'))
const widget=fs.readFileSync(path.join(root,'desktop-studio.html'),'utf8')
assert(widget.includes('row-reset')&&widget.includes('恢复时间：官方暂未提供'))
console.log('AGENT_CATALOG_SEARCH_AUTH_SEPARATION_AND_AUTOMATIC_RESET_UI_PASS')
