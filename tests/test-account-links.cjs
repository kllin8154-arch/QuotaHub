'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {createAccountLinks}=require('../electron/accountLinks.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'agnovexa-link-test-'));
let user=null,accounts=['chatgpt-a','deepseek-a','openrouter-a'];
const TEST_KEY=Buffer.alloc(32,19);
const safeStorage={
 isEncryptionAvailable:()=>true,
 encryptString:value=>{
  const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',TEST_KEY,iv);
  const encrypted=Buffer.concat([c.update(value,'utf8'),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),encrypted]);
 },
 decryptString:bytes=>{
  const d=crypto.createDecipheriv('aes-256-gcm',TEST_KEY,bytes.subarray(0,12));
  d.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8')
 }
};function create(){
 return createAccountLinks({dataDir:root,safeStorage,getGoogleSubject:()=>user,knownAccounts:()=>accounts});
}
try{
 const links=create();
 assert.equal(links.status().verified,false);
 assert.deepEqual(links.status().linked,[]);
 assert.throws(()=>links.link(['chatgpt-a']),/Google/);
 user='google-sub-user-1';
 assert.deepEqual(links.status().unlinked,accounts);
 assert.deepEqual(links.link(['chatgpt-a','deepseek-a','unknown-provider']).linked,['chatgpt-a','deepseek-a']);
 const file=fs.readFileSync(path.join(root,'google-platform-links.enc')).toString('base64');
 assert(file.length>32);
 assert(!file.includes('google-sub-user-1'),'Owner subject must not be stored in plaintext');
 assert(!file.includes('chatgpt-a'),'Provider IDs must not be plaintext');
 const restored=create();assert.equal(restored.status().linkedCount,2);
 assert.deepEqual(restored.status().unlinked,['openrouter-a']);
 user='google-sub-user-2';
 assert.equal(create().status().linkedCount,0);
 assert.equal(create().status().conflictCount,2);
 assert.deepEqual(create().link(['chatgpt-a','openrouter-a']).linked,['openrouter-a']);
 assert.equal(create().status().linkedCount,1);
 user='google-sub-user-1';
 assert.deepEqual(create().unlink(['chatgpt-a']).linked,['deepseek-a']);
 user=null;assert.equal(create().status().linkedCount,0);
 assert.throws(()=>create().link(['openrouter-a']),/Google/);
 user='google-sub-user-1';
 assert.throws(()=>create().link(['../unsafe']),/无效/);
 accounts=['deepseek-a'];
 assert.deepEqual(create().status().linked,['deepseek-a']);
 console.log('ACCOUNT_LINK_ISOLATION_PERSISTENCE_CONFLICT_TEST_PASS');
}finally{
 fs.rmSync(root,{recursive:true,force:true});
}
