'use strict'
const fs=require('node:fs')
const path=require('node:path')
const {discoverAgents}=require('./agentDiscovery.cjs')

const CONFIG_NAMES=Object.freeze({
 opencode:new Set(['opencode.json','opencode.jsonc']),
 codex:new Set(['config.toml']),
 continue:new Set(['config.yaml','config.yml','config.json'])
})
const KNOWN_AGENTS=new Set([
 'opencode','workbuddy','codex','claudecode','geminicli','cline','roocode',
 'kilocode','cursor','windsurf','continue','aider','goose','openhands','trae','augment'
])
const PROVIDERS=Object.freeze({
 openai:'openai-api',deepseek:'deepseek',openrouter:'openrouter',
 anthropic:'claude',google:'gemini',gemini:'gemini',
 siliconflow:'siliconflow',qwen:'qwen',dashscope:'qwen',
 kimi:'kimi',moonshot:'kimi',zhipu:'zhipu',zhipuai:'zhipu'
})
const MAX_FILE=64*1024
function providerKind(input){
 if(typeof input!=='string'||input.length>120)return null
 const id=input.trim().toLowerCase()
 return Object.prototype.hasOwnProperty.call(PROVIDERS,id)?PROVIDERS[id]:null
}
function removeJsoncTrivia(input){
 let out='',quoted=false,escape=false,line=false,block=false
 for(let i=0;i<input.length;i++){
  const c=input[i],n=input[i+1]
  if(line){if(c==='\n'||c==='\r'){line=false;out+=c}else out+=' ';continue}
  if(block){if(c==='*'&&n==='/'){block=false;out+='  ';i++}else out+=c==='\n'?'\n':' ';continue}
  if(quoted){
   out+=c
   if(escape)escape=false
   else if(c==='\\')escape=true
   else if(c==='"')quoted=false
   continue
  }
  if(c==='"'){quoted=true;out+=c;continue}
  if(c==='/'&&n==='/'){line=true;out+='  ';i++;continue}
  if(c==='/'&&n==='*'){block=true;out+='  ';i++;continue}
  out+=c
 }
 // Strip trailing commas only outside string literals.
 let cleaned='',inString=false,esc=false
 for(let i=0;i<out.length;i++){
  const c=out[i]
  if(inString){
   cleaned+=c
   if(esc)esc=false
   else if(c==='\\')esc=true
   else if(c==='"')inString=false
   continue
  }
  if(c==='"'){inString=true;cleaned+=c;continue}
  if(c===','){
   let j=i+1
   while(j<out.length&&/\s/.test(out[j]))j++
   if(out[j]===']'||out[j]==='}')continue
  }
  cleaned+=c
 }
 return cleaned
}
// The parser never returns file contents, paths, model names, secret values, or
// arbitrary strings; only an allowlisted model provider classification.
function identifyProviders(agentId,fileName,content){
 if(!Object.prototype.hasOwnProperty.call(CONFIG_NAMES,agentId)||
   !CONFIG_NAMES[agentId].has(fileName.toLowerCase())||
   typeof content!=='string'||Buffer.byteLength(content,'utf8')>MAX_FILE)return []
 const result=new Set()
 const add=(v)=>{const kind=providerKind(v);if(kind)result.add(kind)}
 try{
  if(agentId==='codex'){
   for(const line of content.split(/\r?\n/)){
    if(/^\s*\[/.test(line))break
    if(/^\s*(?:#|$)/.test(line))continue
    const match=/^\s*model_provider\s*=\s*["']([a-z0-9_-]+)["']\s*(?:#.*)?$/i.exec(line)
    if(match)add(match[1])
   }
  }else if(agentId==='opencode'){
   const cfg=JSON.parse(removeJsoncTrivia(content))
   if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))return []
   // OpenCode model identifiers are provider/model. Model names alone do not identify billing.
   for(const val of [cfg.model,cfg.small_model]){
    if(typeof val==='string'&&val.includes('/'))add(val.split('/')[0])
   }
   const p=cfg.provider||cfg.providers
   if(p&&typeof p==='object'&&!Array.isArray(p))Object.keys(p).slice(0,30).forEach(add)
  }else if(agentId==='continue'){
   if(fileName.endsWith('.json')){
    const cfg=JSON.parse(content)
    if(!cfg||!Array.isArray(cfg.models))return []
    for(const model of cfg.models.slice(0,30))if(model&&typeof model==='object')add(model.provider)
   }else{
    let inModels=false
    for(const line of content.split(/\r?\n/).slice(0,800)){
     if(/^[a-zA-Z][\w-]*\s*:/.test(line))inModels=/^models\s*:/.test(line)
     if(!inModels)continue
     const match=/^\s+(?:-\s+)?provider\s*:\s*["']?([a-z0-9_-]+)["']?\s*(?:#.*)?$/i.exec(line)
     if(match)add(match[1])
    }
   }
  }
 }catch{return []}
 return [...result].sort().slice(0,6)
}
function validDirectory(dir,fileSystem){
 if(typeof dir!=='string'||dir.length>512||!path.isAbsolute(dir))return false
 const normalized=path.resolve(dir)
 if(normalized===path.parse(normalized).root)return false
 try{
  const st=fileSystem.lstatSync(normalized)
  if(!st.isDirectory()||st.isSymbolicLink?.())return false
  const real=typeof fileSystem.realpathSync?.native==='function'
   ?fileSystem.realpathSync.native(normalized):fileSystem.realpathSync?.(normalized)
  if(real&&path.normalize(real).toLowerCase()!==path.normalize(normalized).toLowerCase())return false
  return true
 }catch{return false}
}
function createAgentDiscoveryService({dataDir,dialog,fileSystem=fs,defaults=()=>discoverAgents()}){
 const store=path.join(dataDir,'agent-locations.json')
 function load(){
  try{
   const obj=JSON.parse(fileSystem.readFileSync(store,'utf8'))
   if(!obj||typeof obj!=='object'||Array.isArray(obj))return {}
   const result={}
   for(const [id,dir] of Object.entries(obj))
    if(KNOWN_AGENTS.has(id)&&typeof dir==='string'&&dir.length<=512&&path.isAbsolute(dir))result[id]=dir
   return result
  }catch{return {}}
 }
 function persist(locations){
  const tmp=store+'.tmp'
  fileSystem.writeFileSync(tmp,JSON.stringify(locations),{encoding:'utf8',mode:0o600})
  fileSystem.renameSync(tmp,store)
 }
 function discover(){
  const found=new Map(defaults().filter(x=>KNOWN_AGENTS.has(x.id)).map(x=>[x.id,{id:x.id,evidence:x.evidence}]))
  const custom=load()
  for(const id of Object.keys(custom)){
   if(!validDirectory(custom[id],fileSystem))continue
   const old=found.get(id)
   found.set(id,{id,evidence:old?.evidence||'custom',hasCustomLocation:true})
  }
  return [...found.values()].slice(0,16)
 }
 async function chooseLocation(id){
  if(!KNOWN_AGENTS.has(id))return {status:'unsupported'}
  const selected=await dialog.showOpenDialog({
   title:'为此智能体选择本机安装或配置目录',buttonLabel:'使用此目录',
   properties:['openDirectory','dontAddToRecent']
  })
  if(selected.canceled||!selected.filePaths?.[0])return {status:'canceled'}
  const folder=selected.filePaths[0]
  if(!validDirectory(folder,fileSystem))return {status:'rejected'}
  const old=load()
  persist({...old,[id]:path.resolve(folder)})
  return {status:'saved'}
 }
 function forgetLocation(id){
  if(!KNOWN_AGENTS.has(id))return {status:'unsupported'}
  const old=load()
  if(Object.prototype.hasOwnProperty.call(old,id)){
   delete old[id];persist(old)
  }
  return {status:'removed'}
 }
 async function inspectConfig(id){
  if(!Object.prototype.hasOwnProperty.call(CONFIG_NAMES,id))return {id,status:'unsupported',providers:[]}
  const selected=await dialog.showOpenDialog({
   title:'本地选择配置文件（只提取供应商类别，不保存文件或密钥）',
   buttonLabel:'本地识别',properties:['openFile','dontAddToRecent'],
   filters:[{name:'支持的配置',extensions:['json','jsonc','toml','yaml','yml']}]
  })
  if(selected.canceled||!selected.filePaths?.[0])return {id,status:'canceled',providers:[]}
  const filename=selected.filePaths[0],name=path.basename(filename).toLowerCase()
  if(!CONFIG_NAMES[id].has(name))return {id,status:'unsupported',providers:[]}
  try{
   const stat=fileSystem.lstatSync(filename)
   if(!stat.isFile()||stat.isSymbolicLink?.()||stat.size<0||stat.size>MAX_FILE)
    return {id,status:'rejected',providers:[]}
   // Explicit file-picker authorization only; read once with bounded input.
   const content=fileSystem.readFileSync(filename,'utf8')
   const providers=identifyProviders(id,name,content)
   return {id,status:providers.length?'identified':'unknown',providers}
  }catch{return {id,status:'unknown',providers:[]}}
 }
 return {discover,chooseLocation,forgetLocation,inspectConfig}
}
module.exports={identifyProviders,validDirectory,createAgentDiscoveryService}
