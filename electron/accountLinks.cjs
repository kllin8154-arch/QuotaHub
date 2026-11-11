'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_ACCOUNTS=64;
const SAFE_ID=/^[a-z0-9][a-z0-9_-]{1,100}$/i;
function createAccountLinks({dataDir,safeStorage,getGoogleSubject,knownAccounts}){
 if(!dataDir||!safeStorage||typeof getGoogleSubject!=='function'||typeof knownAccounts!=='function')
  throw Error('Missing account-linkage dependencies');
 const store=path.join(dataDir,'google-platform-links.enc');
 function owner(){
  const sub=getGoogleSubject();
  return typeof sub==='string'&&sub.length>0&&sub.length<=127?
   crypto.createHash('sha256').update('agnovexa-one-google-links-v1:'+sub).digest('hex'):null;
 }
 function read(){
  if(!safeStorage.isEncryptionAvailable()||!fs.existsSync(store))return {version:1,owners:{}};
  try{
   const data=JSON.parse(safeStorage.decryptString(fs.readFileSync(store)));
   if(data?.version!==1||!data.owners||typeof data.owners!=='object'||Array.isArray(data.owners))throw Error('Invalid linked accounts');
   return data;
  }catch{return {version:1,owners:{}}}
 }
 function write(data){
  if(!safeStorage.isEncryptionAvailable())throw Error('系统加密存储不可用');
  const encoded=safeStorage.encryptString(JSON.stringify(data));
  fs.writeFileSync(store+'.tmp',encoded,{mode:0o600});
  fs.renameSync(store+'.tmp',store);
 }
 function known(){
  const keys=knownAccounts();
  return Array.isArray(keys)?[...new Set(keys.filter(x=>typeof x==='string'&&SAFE_ID.test(x)))].slice(0,MAX_ACCOUNTS):[];
 }
 function status(){
  const current=owner(),available=known(),all=read();
  const linked=current?(all.owners[current]||[]).filter(id=>available.includes(id)):[];
  const ownedElsewhere=new Set(Object.entries(all.owners)
   .filter(([id])=>id!==current).flatMap(([,ids])=>Array.isArray(ids)?ids:[]));
  const unlinked=current?available.filter(id=>!linked.includes(id)&&!ownedElsewhere.has(id)):[];
  return {verified:!!current,linked,unlinked,linkedCount:linked.length,availableCount:available.length,
    conflictCount:current?available.filter(id=>ownedElsewhere.has(id)).length:0};
 }
 function link(ids){
  const current=owner();
  if(!current)throw Error('请先完成 Google 身份验证');
  if(!Array.isArray(ids)||ids.length>MAX_ACCOUNTS||ids.some(x=>typeof x!=='string'||!SAFE_ID.test(x)))
    throw Error('账号关联列表无效');
  const all=read(),available=new Set(known()),old=new Set(all.owners[current]||[]);
  const elsewhere=new Set(Object.entries(all.owners).filter(([key])=>key!==current)
   .flatMap(([,items])=>Array.isArray(items)?items:[]));
  for(const id of ids)if(available.has(id)&&!elsewhere.has(id))old.add(id);
  all.owners[current]=[...old].filter(id=>available.has(id)).slice(0,MAX_ACCOUNTS);
  write(all);
  return status();
 }
 function linkOne(id){return link([id])}
 function unlink(ids){
  const current=owner();
  if(!current)throw Error('请先完成 Google 身份验证');
  if(!Array.isArray(ids)||ids.length>MAX_ACCOUNTS||ids.some(x=>typeof x!=='string'||!SAFE_ID.test(x)))
   throw Error('账号解除列表无效');
  const all=read(),remove=new Set(ids);
  all.owners[current]=(all.owners[current]||[]).filter(id=>!remove.has(id));
  write(all);
  return status();
 }
 return {status,link,linkOne,unlink};
}
module.exports={createAccountLinks};
