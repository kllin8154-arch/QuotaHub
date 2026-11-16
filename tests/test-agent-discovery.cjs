'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {discoverAgents}=require('../electron/agentDiscovery.cjs')
const source=fs.readFileSync(path.join(__dirname,'../electron/agentDiscovery.cjs'),'utf8')
assert.doesNotMatch(source,/readFileSync|readdirSync|execSync|spawnSync|child_process|\.cookies?\b|auth\.json|secrets\.json/i)
const exists=new Map([
 ['C:\\Home\\.config\\opencode\\opencode.json',true],
 ['C:\\Home\\.codex\\config.toml',true],
 ['C:\\Local\\Programs\\WorkBuddy',true],
 ['C:\\Roam\\Code\\User\\globalStorage\\saoudrizwan.claude-dev',true],
])
const stat={lstatSync(p){
 if(!exists.has(p))throw Object.assign(new Error('ENOENT'),{code:'ENOENT'})
 return {isFile:()=>!p.endsWith('WorkBuddy'),isDirectory:()=>p.endsWith('WorkBuddy'),isSymbolicLink:()=>false}
}}
const found=discoverAgents({fileSystem:stat,home:'C:\\Home',environment:{LOCALAPPDATA:'C:\\Local',APPDATA:'C:\\Roam'},platform:'win32'})
assert.deepEqual(found.map(x=>x.id).sort(),['cline','codex','opencode','workbuddy'])
assert(found.every(x=>['config','app'].includes(x.evidence)))
assert(!JSON.stringify(found).includes('C:\\'),'Never expose any detected path')
assert.deepEqual(discoverAgents({fileSystem:stat,home:'C:\\Home',platform:'linux'}),[])
const noRead={lstatSync(){return {isSymbolicLink:()=>true,isFile:()=>true}},readFileSync(){throw Error('secret content was read')}}
assert.deepEqual(discoverAgents({fileSystem:noRead,home:'C:\\Home',environment:{},platform:'win32'}),[])
const ui=fs.readFileSync(path.join(__dirname,'../src/PlatformLibrary.tsx'),'utf8')
const bridge=fs.readFileSync(path.join(__dirname,'../electron/preload.cjs'),'utf8')
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8')
assert(ui.includes('discoverAgents')&&ui.includes('readAgentLinks')&&ui.includes('writeAgentLinks'))
assert(ui.includes('重新检测')&&ui.includes('本机发现')&&ui.includes('确认关联'))
assert(bridge.includes('agents:discover')&&main.includes('agents:discover'))
console.log('LOCAL_DISCOVERY_METADATA_ONLY_AND_EXPLICIT_LINK_TEST_PASS')
