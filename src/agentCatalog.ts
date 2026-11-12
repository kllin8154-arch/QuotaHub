import type { ProviderKind } from './types'

export type AgentEntry = {
 id:string
 name:string
 vendor:string
 category:'编程 Agent'|'桌面 Agent'|'IDE 插件'|'自动化平台'
 aliases:string[]
 auth:'API Key / 账号'|'官方账号 / 订阅'|'底层模型 API Key'
 connection:'provider'|'subscription'
 summary:string
 url:string
 providerHints:ProviderKind[]
 note:string
}
export const agentCatalog:AgentEntry[]=[
 {id:'opencode',name:'OpenCode',vendor:'Anomaly',category:'编程 Agent',aliases:['opencode','开源编码','终端agent'],auth:'API Key / 账号',connection:'provider',summary:'终端及桌面编码智能体，可切换多个模型提供商。',url:'https://opencode.ai/docs/providers',providerHints:['openrouter','openai-api','deepseek','relay'],note:'优先关联实际模型提供商；OpenCode 本体的独立套餐不等于模型 API 余额。'},
 {id:'workbuddy',name:'WorkBuddy',vendor:'腾讯云',category:'桌面 Agent',aliases:['work buddy','腾讯','云桌面','tokenhub'],auth:'官方账号 / 订阅',connection:'subscription',summary:'桌面任务执行智能体，可选内置套餐或自定义模型。',url:'https://cloud.tencent.com/document/product/1823/131902',providerHints:['relay','openai-api','deepseek'],note:'腾讯云套餐与自定义模型 API 分开计算；目前不提供通用独立套餐余额读取适配器。'},
 {id:'codex',name:'Codex CLI',vendor:'OpenAI',category:'编程 Agent',aliases:['openai','codex cli','代码代理'],auth:'API Key / 账号',connection:'subscription',summary:'命令行与桌面编程助手，可使用账号订阅或授权 API。',url:'https://developers.openai.com/codex',providerHints:['openai-api'],note:'ChatGPT 订阅额度不等于 OpenAI API 消费。'},
 {id:'claudecode',name:'Claude Code',vendor:'Anthropic',category:'编程 Agent',aliases:['claude','anthropic','claude-code'],auth:'API Key / 账号',connection:'subscription',summary:'终端编码智能体，可使用账号授权或模型 API。',url:'https://docs.anthropic.com/en/docs/claude-code/overview',providerHints:['openrouter','relay'],note:'使用 Claude 订阅时请通过官方页面查看配额；API Key 费用由对应提供商计算。'},
 {id:'geminicli',name:'Gemini CLI',vendor:'Google',category:'编程 Agent',aliases:['gemini','google cli'],auth:'API Key / 账号',connection:'subscription',summary:'Google 开源终端智能体，可使用 Google 身份或 API。',url:'https://github.com/google-gemini/gemini-cli',providerHints:['openrouter','relay'],note:'Google 身份登录不意味着自动获得 Gemini API 用量查询权限。'},
 {id:'cline',name:'Cline',vendor:'Cline',category:'IDE 插件',aliases:['vscode','cline'],auth:'底层模型 API Key',connection:'provider',summary:'VS Code 智能体扩展，可切换模型提供商。',url:'https://cline.bot/',providerHints:['openrouter','deepseek','openai-api','relay'],note:'优先监控 Cline 实际使用的模型服务余额。'},
 {id:'roocode',name:'Roo Code',vendor:'Roo Code',category:'IDE 插件',aliases:['roo','roocode','vscode'],auth:'底层模型 API Key',connection:'provider',summary:'IDE 多模式编码智能体，支持外部模型提供商。',url:'https://roocode.com/',providerHints:['openrouter','deepseek','relay'],note:'额度来自实际使用的模型提供商，不是插件的通用余额。'},
 {id:'kilocode',name:'Kilo Code',vendor:'Kilo',category:'IDE 插件',aliases:['kilo','vscode','jetbrains'],auth:'API Key / 账号',connection:'provider',summary:'IDE 和命令行编码智能体，支持多模型连接。',url:'https://kilo.ai/',providerHints:['openrouter','deepseek','openai-api'],note:'区分 Kilo 服务与自带第三方模型密钥。'},
 {id:'cursor',name:'Cursor',vendor:'Anysphere',category:'IDE 插件',aliases:['cursor','编辑器','ide'],auth:'官方账号 / 订阅',connection:'subscription',summary:'AI 编辑器，支持账号订阅和部分自带模型密钥。',url:'https://cursor.com/dashboard',providerHints:['openai-api','openrouter'],note:'Cursor 订阅额度应在官方账户查询；自带密钥余额由 API 提供商查询。'},
 {id:'windsurf',name:'Windsurf',vendor:'Windsurf',category:'IDE 插件',aliases:['windsurf','cascade','codeium'],auth:'官方账号 / 订阅',connection:'subscription',summary:'AI IDE 与 Cascade 智能体工作流。',url:'https://windsurf.com/',providerHints:['openrouter','relay'],note:'暂未接入 Windsurf 专属配额读取；不能用模型 Key 冒充订阅余额。'},
 {id:'continue',name:'Continue',vendor:'Continue',category:'IDE 插件',aliases:['continue dev','vscode'],auth:'底层模型 API Key',connection:'provider',summary:'开源 IDE 智能编码助手，可自选模型服务。',url:'https://continue.dev/',providerHints:['openrouter','deepseek','openai-api','relay'],note:'通过模型服务本身的额度接口进行监控。'},
 {id:'aider',name:'Aider',vendor:'Aider',category:'编程 Agent',aliases:['aider','terminal','git'],auth:'底层模型 API Key',connection:'provider',summary:'终端协作式编程工具，使用模型提供商密钥。',url:'https://aider.chat/',providerHints:['openrouter','openai-api','deepseek'],note:'Aider 本身不代表一个独立的通用 API 账单。'},
 {id:'goose',name:'Goose',vendor:'Block',category:'桌面 Agent',aliases:['goose','block'],auth:'底层模型 API Key',connection:'provider',summary:'可扩展的本地桌面和命令行智能体。',url:'https://block.github.io/goose/',providerHints:['openrouter','deepseek','openai-api'],note:'根据实际选择的模型提供商监控余额。'},
 {id:'openhands',name:'OpenHands',vendor:'OpenHands',category:'自动化平台',aliases:['open hands','openhands','远程agent'],auth:'API Key / 账号',connection:'provider',summary:'编码与软件任务自动化平台，可自托管或连接模型服务。',url:'https://www.all-hands.dev/',providerHints:['openrouter','openai-api','deepseek'],note:'区分平台账户与模型 API 消耗。'},
 {id:'trae',name:'TRAE',vendor:'TRAE',category:'IDE 插件',aliases:['trae','字节','ide'],auth:'官方账号 / 订阅',connection:'subscription',summary:'集成智能体的开发环境，按产品内授权方式使用。',url:'https://www.trae.ai/',providerHints:['openrouter','relay'],note:'仅关联可授权的底层模型，不伪造 TRAE 官方套餐余额。'},
 {id:'augment',name:'Augment Code',vendor:'Augment',category:'IDE 插件',aliases:['augment','augmentcode'],auth:'官方账号 / 订阅',connection:'subscription',summary:'面向大型代码库的 AI 编码助手。',url:'https://www.augmentcode.com/',providerHints:['openrouter','openai-api'],note:'当前未实现独立订阅配额查询；需要官方授权适配器。'}
]
export const agentSearch=(entry:AgentEntry,term:string)=>{
 const q=term.trim().toLocaleLowerCase()
 return !q || [entry.name,entry.vendor,entry.category,entry.auth,entry.summary,...entry.aliases].join(' ').toLocaleLowerCase().includes(q)
}
