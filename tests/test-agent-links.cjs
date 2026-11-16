'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const code=fs.readFileSync(path.join(__dirname,'../src/agentLinks.ts'),'utf8')
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const db=new Map()
const localStorage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v)}
const mod={}
const catalog={agentCatalog:[{id:'opencode'},{id:'workbuddy'},{id:'codex'}]}
vm.runInNewContext(js,{exports:mod,require:(name)=>{if(name==='./agentCatalog')return catalog;throw Error('Unknown import '+name)},localStorage,Object,Set,JSON})
const {readAgentLinks,writeAgentLinks}=mod
assert.equal(Object.keys(readAgentLinks()).length,0)
writeAgentLinks({opencode:{providerId:'account-1',kind:'deepseek'},workbuddy:{providerId:'account-2',kind:'chatgpt'},
 unknown:{providerId:'qa-secret',kind:'custom'},codex:{providerId:'../../bad',kind:'openai-api'}})
assert.equal(Object.keys(readAgentLinks()).length,2,'Only allowlisted tool IDs and strict provider IDs are persisted')
assert.equal(readAgentLinks().opencode.providerId,'account-1')
assert.equal(readAgentLinks().workbuddy.kind,'chatgpt')
db.set('aiquotahub.agentLinks.v1','{broken')
assert.equal(Object.keys(readAgentLinks()).length,0)
db.set('aiquotahub.agentLinks.v1',JSON.stringify({opencode:{providerId:'account-9',kind:'not-a-provider'}}))
assert.equal(Object.keys(readAgentLinks()).length,0)
const lib=fs.readFileSync(path.join(__dirname,'../src/PlatformLibrary.tsx'),'utf8')
const css=fs.readFileSync(path.join(__dirname,'../src/ui-v0150.css'),'utf8')
assert(lib.includes('knownProviders.find')&&lib.includes('setPending')&&lib.includes('applyLink(')&&lib.includes('unlink('))
assert(lib.includes("evidence==='app'")&&lib.includes('本机发现')&&lib.includes('确认关联'))
for(const selector of ['.agent-discovery-bar button','.agent-link-surface button','.agent-account-choices button','.agent-detected-badge']){
 assert(css.includes(selector),'Missing themed button '+selector)
}
assert(css.includes('var(--ui-control)')&&css.includes('var(--qh-accent)'))
assert(css.includes('@media(max-width:420px)'))
console.log('AGENT_PROVIDER_LINK_ALLOWLIST_PERSISTENCE_AND_THEME_PASS')
