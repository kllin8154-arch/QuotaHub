'use strict'
const assert=require('node:assert/strict')
const vm=require('node:vm')
const fs=require('node:fs')
const path=require('node:path')
const source=fs.readFileSync(path.join(__dirname,'../electron/webQuota.cjs'),'utf8')
const pos=source.indexOf('const READ_SCRIPT=[')
const end=source.indexOf("].join('');",pos)
assert(pos>=0&&end>pos)
const script=vm.runInNewContext(source.slice(pos,end+11).replace('const READ_SCRIPT=','READ_SCRIPT=')+';READ_SCRIPT')
function extract(text){
 const document={querySelector:()=>({innerText:text}),body:{innerText:text}}
 return vm.runInNewContext(script,{document})
}
const text='用量信息\n所有日期按 GMT+8 时间显示\n充值余额 余额预警已开启 去设置\n¥1.88 CNY\n累计消费金额\n¥432.28 CNY\n赠送余额\n¥6.40 CNY\n消费金额\n¥3.93 CNY\nAPI 请求次数\n304'
const extracted=extract(text)
// Only static, public-looking synthetic values; never record actual browser page text.
assert(extracted.includes('充值余额'),'Debit balance label missing')
assert(extracted.includes('赠送余额'),'Gift balance label missing')
assert(extracted.includes('¥1.88'),'Recharge value dropped by DOM excerpt')
assert(extracted.includes('¥6.40'),'Gift value dropped by DOM excerpt')
const evaluator=source.slice(source.indexOf('function parseDeepSeekAccount('),source.indexOf('function chatGPTCandidates('))
const parsed=vm.runInNewContext(evaluator+';parseDeepSeekAccount',{})(extracted)
assert(parsed&&parsed.balance===8.28,JSON.stringify({parsed:!!parsed}))
console.log('DEEPSEEK_OFFICIAL_VISIBLE_BALANCE_1_88_PLUS_6_40_PASS')
