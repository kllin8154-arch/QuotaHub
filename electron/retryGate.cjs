'use strict';

// Per-account in-memory retry timing. No secrets, cookies or account content are stored.
function createRetryGate(now=()=>Date.now()) {
 const accounts=new Map();
 function allowed(id) { return now() >= (accounts.get(id)?.nextAt || 0); }
 function failed(id,error) {
  const message=String(error?.message||error||'').toLowerCase();
  const auth=/401|403|unauthori[sz]ed|forbidden|login|sign.in|session|认证|登录|授权|会话/.test(message);
  const limited=/429|rate.limit|too.many|限流|频率/.test(message);
  const count=Math.min(6,(accounts.get(id)?.count||0)+1);
  const base=limited?15*60_000:auth?5*60_000:90_000;
  const delay=Math.min(30*60_000,base*2**(count-1));
  accounts.set(id,{count,nextAt:now()+delay});
  return delay;
 }
 function succeeded(id) {accounts.delete(id);}
 function forget(id) {accounts.delete(id);}
 return {allowed,failed,succeeded,forget};
}
module.exports={createRetryGate};
