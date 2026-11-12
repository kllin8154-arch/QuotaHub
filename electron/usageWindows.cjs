'use strict';
const {parseCandidate}=require('./quotaReset.cjs');
const SECRET=/(?:api[_ -]?key|password|secret|bearer|authorization|cookie|验证码|密钥|密码|令牌|sk-[a-z0-9]|@)/i;
const SECTION={
 'five-hour':/(?:^|\b)(?:5\s*[- ]?\s*(?:小时|hours?|hrs?|h)\s*(?:限额|额度|limit|allowance)|(?:限额|额度|limit)\s*(?:\(?)5\s*[- ]?\s*(?:小时|hours?|h))/i,
 'weekly':/(?:每周|本周|weekly|7\s*days?|7\s*天)\s*(?:限额|额度|limit|allowance)/i
};
const NAME={'five-hour':'5 小时限额','weekly':'每周限额'};
function parsedSection(s){
 if(SECTION['five-hour'].test(s))return 'five-hour';
 if(SECTION.weekly.test(s))return 'weekly';
 return null;
}
function remainingPercent(section){
 for(let i=0;i<section.length;i++){
  const line=section[i];
  if(!/(?:剩余|可用|remaining|available|left)/i.test(line))continue;
  const joined=line+' '+(section[i+1]||'');
  const m=joined.match(/(?:剩余|可用|remaining|available|left)[^0-9]{0,20}(\d{1,3}(?:\.\d+)?)\s*%/i);
  if(m){const n=Number(m[1]);if(n>=0&&n<=100)return n}
 }
 return null;
}
function windowsFromVisibleText(text,now=Date.now()){
 if(!Number.isFinite(now))return [];
 const lines=String(text||'').slice(0,15000).split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,160);
 const windows=[];
 for(let i=0;i<lines.length;i++){
  const id=parsedSection(lines[i]);
  if(!id||SECRET.test(lines[i])||windows.some(w=>w.id===id))continue;
  const section=[];
  for(let j=i+1;j<lines.length&&j<=i+14;j++){
   if(parsedSection(lines[j]))break;
   if(!SECRET.test(lines[j]))section.push(lines[j]);
  }
  const resets=[];
  for(let j=0;j<section.length;j++){
   const current=section[j];
   if(!/(?:重置|恢复|refresh|reset)/i.test(current))continue;
   // A period title like "5 hours" is never a reset; only explicit reset labels count.
   const next=section[j+1]||'';
   const candidate=parseCandidate(current+(next&&!parsedSection(next)?'\n'+next:''),now);
   if(candidate && candidate.date.getTime()>now-120000 && candidate.date.getTime()<now+31*86400000)
    resets.push({resetAt:candidate.date.toISOString(),resetBasis:candidate.basis,resetPrecision:candidate.precision});
  }
  const unique=resets.filter((r,n,a)=>a.findIndex(x=>Math.abs(Date.parse(x.resetAt)-Date.parse(r.resetAt))<=2*60_000)===n);
  const reset=unique.length===1?unique[0]:null;
  const remaining=remainingPercent(section);
  if(remaining===null&&!reset)continue;
  windows.push({id,label:NAME[id],remainingPercent:remaining,
   resetAt:reset?.resetAt??null,resetBasis:reset?.resetBasis??null,
   resetPrecision:reset?.resetPrecision??null,observedAt:new Date(now).toISOString()});
 }
 return windows;
}
function planTierFromVisibleText(text){
 const lines=String(text||'').slice(0,16000).split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,200);
 const eligible=/^(?:我的套餐|当前套餐|套餐等级|我的订阅|订阅方案|current plan|your plan|my plan|active plan|subscription plan)\s*[:：-]?\s*/i;
 const unsafe=/(?:upgrade|choose|switch|compare|pricing|billing history|购买|升级|切换|推荐|推荐套餐)/i;
 const normalize=s=>{
  const v=s.trim();
  if(unsafe.test(v)||v.length>55)return null;
  let m=v.match(/(?:ChatGPT\s+)?Pro\s*(100|200|500)\b/i);
  if(m)return 'Pro '+m[1];
  m=v.match(/(?:ChatGPT\s+)?Pro\s*(5|10|20)\s*[x×倍]/i);
  if(m)return 'Pro '+m[1]+'x';
  m=v.match(/^(?:ChatGPT\s+)?(5|10|20)\s*[x×倍]\s*Pro$/i);
  if(m)return 'Pro '+m[1]+'x';
  if(/(?:^|\s)(?:ChatGPT\s+)?Pro(?:$|\s)/i.test(v))return 'Pro（等级未细分）';
  if(/(?:^|\s)(?:ChatGPT\s+)?Plus(?:$|\s)/i.test(v))return 'Plus';
  if(/(?:^|\s)(?:ChatGPT\s+)?Go(?:$|\s)/i.test(v))return 'Go';
  if(/(?:^|\s)(?:ChatGPT\s+)?Business(?:$|\s)/i.test(v))return 'Business';
  if(/(?:^|\s)(?:ChatGPT\s+)?Enterprise(?:$|\s)/i.test(v))return 'Enterprise';
  if(/(?:^|\s)(?:ChatGPT\s+)?Edu(?:$|\s)/i.test(v))return 'Edu';
  if(/(?:^|\s)(?:ChatGPT\s+)?Free(?:$|\s)/i.test(v))return 'Free';
  return null;
 };
 for(let i=0;i<lines.length;i++){
  if(SECRET.test(lines[i])||unsafe.test(lines[i])||!eligible.test(lines[i]))continue;
  const tail=lines[i].replace(eligible,'').trim();
  const plan=normalize(tail)||(!tail?normalize(lines[i+1]||''):null);
  if(plan)return plan;
 }
 return null;
}
module.exports={windowsFromVisibleText,planTierFromVisibleText};
