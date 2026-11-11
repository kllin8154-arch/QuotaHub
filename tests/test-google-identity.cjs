'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createGoogleIdentity,challengeFor,validClientId,SCOPES}=require('../electron/googleIdentity.cjs');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quotahub-google-qa-'));
const clientId='123456789012-syntheticqaonlydesktopclient.apps.googleusercontent.com';
const safeStorage={
 isEncryptionAvailable:()=>true,
 encryptString:text=>Buffer.from('win-encrypted:'+text,'utf8'),
 decryptString:buffer=>{
  const encoded=buffer.toString('utf8');
  if(!encoded.startsWith('win-encrypted:'))throw Error('not encrypted');
  return encoded.slice(14);
 }
};
let opened=null;let receivedPage=null;
const fetched=[];
async function mockFetch(url,init){
 fetched.push(url);
 if(url==='https://oauth2.googleapis.com/token'){
  const params=new URLSearchParams(init.body);
  assert.equal(params.get('client_id'),clientId);
  assert.equal(params.get('grant_type'),'authorization_code');
  assert(params.get('code_verifier').length>42);
  assert.equal(challengeFor(params.get('code_verifier')),opened.searchParams.get('code_challenge'));
  assert.equal(params.get('redirect_uri'),opened.searchParams.get('redirect_uri'));
  return {ok:true,headers:{get:()=>null},json:async()=>({access_token:'synthetic-only-not-a-real-token-value'})};
 }
 if(url==='https://openidconnect.googleapis.com/v1/userinfo'){
  assert(init.headers.Authorization.includes('synthetic-only'));
  return {ok:true,headers:{get:()=>null},json:async()=>({
   sub:'9876543210',email:'synthetic.user@example.test',email_verified:true,name:'QuotaHub Test User'
  })};
 }
 throw Error('Unexpected request: '+url);
}
function localGet(url){return new Promise((resolve,reject)=>{const req=require('node:http').get(url,{agent:false},res=>{let body='';res.on('data',part=>body+=part.toString());res.on('end',()=>resolve({status:res.statusCode,body}))});req.on('error',reject)})}
const shell={openExternal:async url=>{
 opened=new URL(url);
 assert.equal(opened.hostname,'accounts.google.com');
 assert.equal(opened.searchParams.get('scope'),SCOPES);
 assert.equal(opened.searchParams.get('code_challenge_method'),'S256');
 assert.equal(opened.searchParams.get('response_type'),'code');
 assert.equal(opened.searchParams.get('access_type'),'online');
 const uri=new URL(opened.searchParams.get('redirect_uri'));
 assert.equal(uri.hostname,'127.0.0.1');
 assert(uri.port);
 const bad=new URL(uri);
 bad.searchParams.set('state','invalid-state');
 bad.searchParams.set('code','SYNTHETIC-CODE-ONLY');
 const wrong=await localGet(bad);
 assert.equal(wrong.status,403);
 assert(!fs.existsSync(path.join(dir,'google-identity.enc')));
 const good=new URL(uri);
 good.searchParams.set('state',opened.searchParams.get('state'));
 good.searchParams.set('code','SYNTHETIC-CODE-ONLY');
 receivedPage=localGet(good);
}};
async function test(){
 const auth=createGoogleIdentity({dataDir:dir,safeStorage,shell,fetchImpl:mockFetch,timeoutMs:3000});
 assert.equal(auth.status().configured,false);
 assert.equal(auth.status().profile,null);
 await assert.rejects(auth.signIn(),/Client ID/);
 assert.equal(validClientId('not-real-client'),false);
 assert.throws(()=>auth.configure('malformed'),/Client ID/);
 auth.configure(clientId);
 assert.equal(auth.status().configured,true);
 const result=await auth.signIn();
 const callbackPage=await receivedPage;
 assert.equal(callbackPage.status,200);
 assert(callbackPage.body.includes('登录验证成功'));
 assert(callbackPage.body.includes('Agnovexa One'));
 assert(!callbackPage.body.includes('QuotaHub'));
 assert.equal(result.busy,false);
 assert.equal(result.profile.name,'QuotaHub Test User');
 assert.equal(result.profile.email,'synthetic.user@example.test');
 assert.equal(result.profile.emailVerified,true);
 assert.equal(fetched.length,2);
 assert(!fs.existsSync(path.join(dir,'google-oauth-client.json.tmp')));
 const ciphertext=fs.readFileSync(path.join(dir,'google-identity.enc'),'utf8');
 assert(ciphertext.startsWith('win-encrypted:'));
 assert(!ciphertext.includes('synthetic-only-not-a-real-token-value'),'Access token must never be stored');
 assert(!ciphertext.includes('SYNTHETIC-CODE-ONLY'),'Authorization code must never be stored');
 // A full app restart recreates the module using the same encrypted local data.
 const restored=createGoogleIdentity({dataDir:dir,safeStorage,shell,fetchImpl:mockFetch});
 assert.equal(restored.status().profile.email,'synthetic.user@example.test');
 assert.equal(restored.status().configured,true);
 restored.signOut();
 assert.equal(restored.status().profile,null);
 assert(!fs.existsSync(path.join(dir,'google-identity.enc')));
 assert(fs.existsSync(path.join(dir,'google-oauth-client.json')),'Developer config stays after sign-out');
 // Regression: receiving a valid callback is NOT equivalent to successful login.
 const failed=createGoogleIdentity({dataDir:dir,safeStorage,shell,
   fetchImpl:async()=>{throw TypeError('fetch failed')},timeoutMs:3000});
 await assert.rejects(failed.signIn(),/Google 令牌兑换网络请求失败/);
 const failurePage=await receivedPage;
 assert(failurePage.body.includes('登录验证未完成'));
 assert(!failurePage.body.includes('登录验证成功'));
 assert.equal(failed.status().profile,null);
 assert.equal(fs.existsSync(path.join(dir,'google-identity.enc')),false);
 console.log('GOOGLE_OAUTH_PKCE_LOOPBACK_IDENTITY_TEST_PASS');
 console.log('GOOGLE_OAUTH_CALLBACK_STATUS_AND_PROXY_FAILURE_TEST_PASS');
}
test().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
