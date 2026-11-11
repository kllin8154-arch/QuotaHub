import type { ProviderKind } from './types'
export const definitions: { kind: ProviderKind; name: string; category: 'API' | '订阅'; mode: 'live' | 'manual'; metric: 'balance' | 'usage' | 'spend'; unit: string; url: string; tagline: string; hue: string; symbol: string }[] = [
{kind:'relay',name:'API 中转站',category:'API',mode:'live',metric:'balance',unit:'额度点',url:'https://docs.newapi.ai/',tagline:'支持 New API / One API / 自定义余额接口',hue:'slate',symbol:'R'},
{kind:'deepseek',name:'DeepSeek API',category:'API',mode:'live',metric:'balance',unit:'CNY',url:'https://platform.deepseek.com/usage',tagline:'深度思考，清晰掌控',hue:'blue',symbol:'D'},
{kind:'chatgpt',name:'ChatGPT',category:'订阅',mode:'manual',metric:'usage',unit:'次',url:'https://chatgpt.com/settings/usage',tagline:'订阅与使用限制',hue:'green',symbol:'◎'},
{kind:'openai-api',name:'OpenAI API',category:'API',mode:'live',metric:'spend',unit:'USD',url:'https://platform.openai.com/usage',tagline:'组织级 API 费用',hue:'slate',symbol:'O'},
{kind:'claude',name:'Claude',category:'订阅',mode:'manual',metric:'usage',unit:'次',url:'https://claude.ai/settings',tagline:'Anthropic 订阅额度',hue:'orange',symbol:'✳'},
{kind:'gemini',name:'Gemini',category:'订阅',mode:'manual',metric:'usage',unit:'次',url:'https://gemini.google.com/',tagline:'Google AI 使用情况',hue:'violet',symbol:'✦'},
{kind:'siliconflow',name:'硅基流动',category:'API',mode:'manual',metric:'balance',unit:'CNY',url:'https://cloud.siliconflow.cn/',tagline:'模型调用余额',hue:'purple',symbol:'S'},
{kind:'openrouter',name:'OpenRouter',category:'API',mode:'live',metric:'balance',unit:'USD',url:'https://openrouter.ai/credits',tagline:'聚合模型额度',hue:'indigo',symbol:'R'},
{kind:'qwen',name:'阿里云百炼',category:'API',mode:'manual',metric:'balance',unit:'CNY',url:'https://bailian.console.aliyun.com/',tagline:'模型服务与计费',hue:'teal',symbol:'Q'},
{kind:'kimi',name:'Kimi',category:'订阅',mode:'manual',metric:'usage',unit:'次',url:'https://www.kimi.com/',tagline:'月度使用额度',hue:'blue',symbol:'K'},
{kind:'zhipu',name:'智谱 AI',category:'API',mode:'manual',metric:'balance',unit:'CNY',url:'https://open.bigmodel.cn/',tagline:'GLM API 余额',hue:'violet',symbol:'Z'},
{kind:'cursor',name:'Cursor',category:'订阅',mode:'manual',metric:'usage',unit:'次',url:'https://cursor.com/dashboard',tagline:'编码工具用量',hue:'slate',symbol:'C'}
]
// No default accounts: the user binds their own platforms.
