import assert from 'node:assert/strict'
import { syncHealth, lastSampleText } from '../src/syncHealth.ts'

const now = Date.parse('2026-11-12T01:30:00Z')
const source = (props = {}) => ({ connected: true, webMonitored: false, updatedAt: new Date(now - 100_000).toISOString(), error: '', ...props })
assert.equal(syncHealth(source(), now), 'healthy')
assert.equal(syncHealth(source({ updatedAt: new Date(now-300_001).toISOString() }), now), 'delayed')
assert.equal(syncHealth(source({ updatedAt: '' }), now), 'pending')
assert.equal(syncHealth(source({ error: 'login expired' }), now), 'error')
assert.equal(syncHealth(source({ connected: false, webMonitored: false, error: 'old error' }), now), 'manual')
assert.equal(syncHealth(source({ updatedAt: new Date(now+75_000).toISOString() }), now), 'pending')
assert.equal(lastSampleText(new Date(now-100_000).toISOString(), now), '1 分钟前采集')
assert.equal(lastSampleText(), '尚无有效采样')
console.log('SYNC_HEALTH_6_CASES_AND_TIME_LABELS_PASS')
