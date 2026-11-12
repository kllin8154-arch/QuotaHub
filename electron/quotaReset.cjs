'use strict';
// Strictly parse quota-window reset labels from already-filtered visible text.
// No cookies, private JS state, request interception, or inferred subscription cycles.
const resetLabel=/(?:\breset(?:s|ting)?\b|\brefreshes\b|(?:用量|额度|限额|次数|消息).{0,8}(?:重置|恢复)|(?:重置|恢复)(?:时间|于|倒计时|剩余)|(?:重新可用|下次重置))/i;
const secret=/(?:api[_\s-]?key|password|secret|bearer|authorization|cookie|验证码|密钥|密码|令牌|sk-[a-z0-9]|@)/i;
function makeDate(y,m,d,h=0,min=0){
 const value=new Date(y,m-1,d,h,min,0,0);
 return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d&&value.getHours()===h&&value.getMinutes()===min?value:null;
}
function parseCandidate(s,now){
 const text=String(s).slice(0,240);
 let m=text.match(/(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})日?\s*(?:at|在|于|,)?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
 if(m){
  let h=Number(m[4]);const min=Number(m[5]),amp=m[6]?.toUpperCase();
  if(amp){if(h<1||h>12)return null;h=h%12+(amp==='PM'?12:0)}
  const d=makeDate(+m[1],+m[2],+m[3],h,min);
  if(d)return {date:d,basis:'explicit',precision:'minute'};
 }
 m=text.match(/(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})日?/);
 if(m){
  const d=makeDate(+m[1],+m[2],+m[3]);
  if(d)return {date:d,basis:'explicit',precision:'date'};
 }
 // No approximate date is fabricated from a time-of-day alone.
 m=text.match(/(?:\bin\s*|后|剩余|还有)?\s*(\d+(?:\.\d+)?\s*(?:days?|d|天|hours?|hrs?|hr|h|小时|minutes?|mins?|min|m|分钟)(?:\s*(?:and|与|零)?\s*\d+(?:\.\d+)?\s*(?:days?|d|天|hours?|hrs?|hr|h|小时|minutes?|mins?|min|m|分钟))*)/i);
 if(!m)return null;
 let ms=0,parts=0;
 for(const v of m[1].matchAll(/(\d+(?:\.\d+)?)\s*(days?|d|天|hours?|hrs?|hr|h|小时|minutes?|mins?|min|m|分钟)/gi)){
  const number=Number(v[1]);const unit=v[2].toLowerCase();
  const factor=/^(?:d|day|days|天)$/.test(unit)?86400000:/^(?:h|hr|hrs|hour|hours|小时)$/.test(unit)?3600000:60000;
  ms+=number*factor;parts++;
 }
 if(!parts||ms<60000||ms>31*86400000)return null;
 return {date:new Date(now+ms),basis:'countdown',precision:'minute'};
}
function visibleQuotaReset(text,now=Date.now()){
 if(!Number.isFinite(now))return null;
 const lines=String(text||'').slice(0,12000).split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,130);
 const found=[];
 for(let i=0;i<lines.length;i++){
  if(!resetLabel.test(lines[i])||secret.test(lines[i]))continue;
  const current=lines[i];
  const adjacent=i+1<lines.length && !secret.test(lines[i+1]) && !resetLabel.test(lines[i+1])?lines[i+1]:'';
  const value=parseCandidate(current+' '+adjacent,now);
  if(!value)continue;
  const millis=value.date.getTime();
  if(millis<now-120000 || millis>now+31*86400000)continue;
  found.push({resetAt:value.date.toISOString(),resetBasis:value.basis,resetPrecision:value.precision});
 }
 // Pages can have multiple model-specific windows. Never falsely label one as universal.
 if(!found.length)return null;
 const first=found[0];
 if(found.some(x=>Math.abs(Date.parse(x.resetAt)-Date.parse(first.resetAt))>60000))return null;
 return first;
}
module.exports={visibleQuotaReset};
