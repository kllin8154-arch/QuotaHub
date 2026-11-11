import { Capacitor, registerPlugin } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import type { LiveResult, RelayConfig } from './types'

type Kind = 'deepseek' | 'openai-api' | 'openrouter' | 'relay'
interface QuotaAndroid {
 connect(options: { kind: Kind; id: string; key: string; relay?:RelayConfig }): Promise<LiveResult>
 refresh(options: { kind: Kind; id: string }): Promise<LiveResult>
 disconnect(options: { kind: Kind; id: string }): Promise<{ success: boolean }>
 connected(): Promise<{ ids: string[] }>
}
const allowed = new Set([
 'platform.deepseek.com','chatgpt.com','platform.openai.com','claude.ai',
 'gemini.google.com','cloud.siliconflow.cn','openrouter.ai',
 'bailian.console.aliyun.com','www.kimi.com','open.bigmodel.cn','cursor.com'
])
if (Capacitor.getPlatform() === 'android') {
 const native = registerPlugin<QuotaAndroid>('QuotaAndroid')
 window.quotaBridge = {
  connect: (kind, id, key, relay) => native.connect({ kind, id, key, relay }),
  refresh: (kind, id) => native.refresh({ kind, id }),
  disconnect: async (kind, id) => (await native.disconnect({ kind, id })).success,
  connected: async () => (await native.connected()).ids,
  openExternal: async url => {
   const parsed = new URL(url)
   if (parsed.protocol !== 'https:' || !allowed.has(parsed.hostname)) throw new Error('不支持的官方地址')
   await Browser.open({ url: parsed.href })
  }
 }
}
