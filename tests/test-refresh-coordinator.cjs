'use strict';
const assert=require('node:assert/strict');
const {createRefreshCoordinator}=require('../electron/refreshCoordinator.cjs');

async function main(){
 let apiCalls=0, webCalls=0, release, current=[{id:'deepseek-a',value:8,updatedAt:'OLD'}];
 const gate=new Promise(resolve=>{release=resolve});
 const refresh=createRefreshCoordinator({
  pollApi:async()=>{apiCalls++;await gate;current=[...current,{id:'router-b',value:17,updatedAt:'NEW'}]},
  pollWeb:async()=>{webCalls++;await gate;current=[{id:'deepseek-a',value:7,updatedAt:'NEW'}]},
  readAccounts:()=>current.map(x=>({...x}))
 });
 const a=refresh.refresh(),b=refresh.refresh();
 await Promise.resolve();await Promise.resolve();
 assert.equal(apiCalls,1,'duplicate click must not query API twice');
 assert.equal(webCalls,1,'duplicate click must not reload website twice');
 release();
 const [first,second]=await Promise.all([a,b]);
 assert.deepEqual(first,second,'concurrent callers see the same final snapshot');
 assert.equal(first.find(x=>x.id==='deepseek-a')?.value,7,'must return post-refresh amount');
 assert.equal(first.find(x=>x.id==='router-b')?.value,17,'must preserve both source results');
 await refresh.refresh();
 assert.equal(apiCalls,2,'subsequent user refresh executes again');
 assert.equal(webCalls,2,'subsequent user refresh executes again');
 const broken=createRefreshCoordinator({pollApi:async()=>{},pollWeb:async()=>{throw Error('site timeout')},readAccounts:()=>[{value:999}]});
 await assert.rejects(broken.refresh(),/site timeout/,'failed refresh must not report success with stale snapshot');
 await assert.rejects(broken.refresh(),/site timeout/,'lock must release after failure');
 console.log('REFRESH_COORDINATOR_CONCURRENT_AND_STALE_OVERWRITE_TEST_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
