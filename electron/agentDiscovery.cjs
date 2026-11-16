'use strict'
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')

// Deliberately read metadata only. Never traverse, read a config file, enumerate
// extensions, inspect secrets/auth databases, or execute installed programs.
// A hit is evidence of a local config/install, NOT an authenticated subscription.
const specs=[
 ['opencode','config','home','.config','opencode','opencode.json'],
 ['opencode','config','managed','opencode','opencode.json'],
 ['opencode','config','managed','opencode','opencode.jsonc'],
 ['opencode','config','xdg','opencode','opencode.json'],
 ['opencode','config','xdg','opencode','opencode.jsonc'],
 ['opencode','config','home','.config','opencode','opencode.jsonc'],
 ['opencode','config','home','.config','opencode'],
 ['codex','config','home','.codex','config.toml'],
 ['codex','config','home','.codex'],
 ['claudecode','config','home','.claude','settings.json'],
 ['claudecode','config','home','.claude'],
 ['geminicli','config','home','.gemini','settings.json'],
 ['geminicli','config','home','.gemini'],
 ['workbuddy','app','local','Programs','WorkBuddy'],
 ['workbuddy','config','roaming','WorkBuddy'],
 ['cursor','app','local','Programs','cursor'],
 ['cursor','config','roaming','Cursor'],
 ['windsurf','app','local','Programs','Windsurf'],
 ['windsurf','config','roaming','Windsurf'],
 ['continue','config','home','.continue'],
 ['aider','config','home','.aider.conf.yml'],
 ['goose','config','home','.config','goose'],
 ['trae','app','local','Programs','TRAE'],
 ['trae','config','roaming','Trae'],
 ['cline','config','roaming','Code','User','globalStorage','saoudrizwan.claude-dev'],
 ['roocode','config','roaming','Code','User','globalStorage','rooveterinaryinc.roo-cline'],
 ['kilocode','config','roaming','Code','User','globalStorage','kilocode.kilo-code'],
 ['augment','config','roaming','Code','User','globalStorage','augment.vscode-augment'],
]
const allowed=new Set(specs.map(row=>row[0]))
function discoverAgents({fileSystem=fs,home=os.homedir(),environment=process.env,platform=process.platform}={}){
 if(platform!=='win32')return []
 const roots={
  home:home,
  local:environment.LOCALAPPDATA||path.join(home,'AppData','Local'),
  roaming:environment.APPDATA||path.join(home,'AppData','Roaming'),
  managed:environment.PROGRAMDATA||path.join(path.parse(home).root,'ProgramData'),
  xdg:environment.XDG_CONFIG_HOME||path.join(home,'.config')
 }
 const found=new Map()
 for(const [id,evidence,root,...parts] of specs){
  const base=roots[root]
  if(!base||typeof base!=='string'||!path.isAbsolute(base))continue
  const candidate=path.join(base,...parts)
  try{
   const info=fileSystem.lstatSync(candidate)
   if(info.isSymbolicLink?.())continue
   if(!info.isDirectory?.()&&!info.isFile?.())continue
   if(!found.has(id)||evidence==='config')found.set(id,{id,evidence})
  }catch{/* Not installed, no permission, or missing: simply not found. */}
 }
 // Explicit environment overrides are already configured by the user.
 // Metadata check only: never read these files or return their paths.
 for(const [id,file] of [
  ['opencode',environment.OPENCODE_CONFIG],
  ['codex',environment.CODEX_HOME?path.join(environment.CODEX_HOME,'config.toml'):null]
 ]){
  if(!file||typeof file!=='string'||file.length>512||!path.isAbsolute(file))continue
  if(id==='opencode'&&!['opencode.json','opencode.jsonc'].includes(path.basename(file).toLowerCase()))continue
  try{
   const info=fileSystem.lstatSync(file)
   if(info.isSymbolicLink?.()||!info.isFile?.())continue
   if(!found.has(id))found.set(id,{id,evidence:'config'})
  }catch{}
 }
 return [...found.values()].filter(entry=>allowed.has(entry.id)).slice(0,16)
}
module.exports={discoverAgents}
