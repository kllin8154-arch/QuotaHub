'use strict'
const DEEPSEEK_RELOAD_INTERVAL_MS=5*60*1000
function classifyWebError(status,errorCode){
 if(status===429)return 'rate-limit'
 if(status===401||status===403)return 'access-denied'
 if(status>=500&&status<=599)return 'server-error'
 if(errorCode && errorCode!==-3)return 'network'
 return 'empty'
}
function errorMessage(reason){
 switch(reason){
 case 'rate-limit':return {title:'官方服务暂时限流',subtitle:'DeepSeek 当前拒绝了过于频繁的请求（HTTP 429）。已暂停重复采集，保留上次有效额度，建议至少 15 分钟后重试。'}
 case 'access-denied':return {title:'官方页面暂不可访问',subtitle:'访问受到官网限制或授权可能已过期。请核对网络与官网登录状态；不会自动清除已有会话。'}
 case 'server-error':return {title:'官网暂时不可用',subtitle:'上游服务器返回错误。已保留最后一次成功记录，稍后可重试。'}
 case 'network':return {title:'无法连接官方额度页面',subtitle:'请检查网络、代理与证书设置。不会将错误页面当成最新额度。'}
 default:return {title:'官方页面暂时没有正常显示',subtitle:'网页加载后仍然空白。可以稍后重新访问，或在系统浏览器中检查官网是否正常。'}
 }
}
// Only known constant HTTPS URLs, never constructed from a web page or user input.
function officialFailureHtml(siteUrl,reason){
 if(typeof siteUrl!=='string'||/[<>"'\s]/.test(siteUrl)||!/^https:\/\/(?:platform\.deepseek\.com|chatgpt\.com|claude\.ai|gemini\.google\.com|platform\.openai\.com|openrouter\.ai|cloud\.siliconflow\.cn|bailian\.console\.aliyun\.com|www\.kimi\.com|open\.bigmodel\.cn|cursor\.com)\//.test(siteUrl))throw Error('Unsafe official URL')
 const message=errorMessage(reason)
 const heading=message.title,description=message.subtitle
 return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>官方额度页面暂不可用 · Agnovexa One</title>'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#f7f9fa;color:#253443;font:14px "Microsoft YaHei","Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}'+
 'article{width:min(100%,540px);border-radius:18px;border:1px solid #e2e7eb;background:white;padding:36px;box-shadow:0 20px 55px #1b334512}.ico{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:#e4f4ed;color:#16775b;font-size:24px;font-weight:750}'+
 'h1{font-size:22px;margin:21px 0 10px}p{line-height:1.85;color:#65778a;margin:0 0 22px}.buttons{display:flex;flex-wrap:wrap;gap:10px}'+
 '.buttons a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 15px;border:1px solid #d2dde3;border-radius:10px;text-decoration:none;color:#264b60;font-size:13px;font-weight:650;background:#f8fbfc}.buttons a.primary{background:#15775e;color:white;border-color:#15775e}.buttons a:hover{filter:brightness(.96)}.buttons a:focus-visible{outline:2px solid #15775e;outline-offset:3px}small{display:block;margin-top:23px;color:#8a9aa5;line-height:1.7}</style></head>'+
 '<body><article><div class="ico">!</div><h1>'+heading+'</h1><p>'+description+'</p><div class="buttons"><a class="primary" href="'+siteUrl+'">重试访问官网</a><a href="'+siteUrl+'" target="_blank" rel="noopener noreferrer">在系统浏览器打开</a></div>'+
 '<small>数据与登录会话保存在本机。错误页面不代表额度为零；恢复前显示的余额均为上次有效记录。</small></article></body></html>'
}
function shouldHardRefresh(kind,previousAt,now=Date.now()){
 if(kind!=='deepseek')return true
 return !Number.isFinite(previousAt)||now-previousAt>=DEEPSEEK_RELOAD_INTERVAL_MS
}
module.exports={classifyWebError,errorMessage,officialFailureHtml,shouldHardRefresh,DEEPSEEK_RELOAD_INTERVAL_MS}
