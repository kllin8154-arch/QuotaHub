'use strict'
const assert=require('node:assert/strict')
const vm=require('node:vm')
const fs=require('node:fs')
const path=require('node:path')
const source=fs.readFileSync(path.join(__dirname,'../electron/webQuota.cjs'),'utf8')
const pos=source.indexOf('const READ_SCRIPT=[')
const end=source.indexOf("].join('');",pos)
assert(pos>=0&&end>pos)
const js=source.slice(pos,end+11).replace('const READ_SCRIPT=','READ_SCRIPT=')
const ctx={}
const script=vm.runInNewContext(js+';READ_SCRIPT',ctx)
const userFacing='套餐限额\n5 小时限额\n3小时34分钟 后重置\n剩余 0%\n每周限额\n6天22小时 后重置\n剩余 84%\n当前套餐\nPlus'
const document={querySelector:()=>({innerText:userFacing}),body:{innerText:userFacing}}
const extracted=vm.runInNewContext(script,{document})
const {windowsFromVisibleText,planTierFromVisibleText}=require('../electron/usageWindows.cjs')
const windows=windowsFromVisibleText(extracted,Date.parse('2026-11-12T13:05:00+08:00'))
assert.equal(windows.length,2,extracted)
assert.equal(windows[0].remainingPercent,0)
assert.equal(windows[1].remainingPercent,84)
assert(windows.every(w=>w.resetAt),'Each usage window must retain its own reset after filter')
assert.equal(planTierFromVisibleText(extracted),'Plus')
assert(!extracted.includes('undefined'))
console.log('VISIBLE_USAGE_EXCERPT_PRESERVES_BOTH_WINDOW_RESETS_PASS')
