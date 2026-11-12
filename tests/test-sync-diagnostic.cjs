const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/syncHealth.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, Date, Number, Math });
const { syncDiagnostic, safeErrorText } = moduleExports;
const now = Date.parse('2026-11-12T03:00:00Z');
const sample = { connected: true, updatedAt: '2026-11-12T02:59:00Z' };
assert.equal(syncDiagnostic(sample, now), null);
assert.match(syncDiagnostic({ ...sample, updatedAt: '2026-11-12T02:45:00Z' }, now), /超过 5 分钟/);
assert.match(syncDiagnostic({ ...sample, updatedAt: undefined }, now), /尚无有效/);
for (const [raw, expected] of [
  ['401 session cookie=secret-authorization-token', /授权可能已失效/],
  ['QUOTA_PARSE_NO_VALUE: 官网页面未识别到可核对的余额或额度数值', /官方页面已打开/],
  ['没有发现可核对的额度数值，请检查页面内容和登录状态', /官方页面已打开/],
  ['429 rate limit token=secret', /请求频率/],
  ['network timeout token=secret', /网络连接/],
  ['selector mismatch token=secret', /页面可能已调整/],
  ['unexpected error apiKey=secret', /本次采集失败/]
]) {
 const output = syncDiagnostic({ ...sample, error: raw }, now);
 assert.match(output, expected);
 assert.doesNotMatch(output, /secret|cookie=|apiKey=/i);
 assert.equal(safeErrorText(raw), output);
 assert.equal(safeErrorText(output), output, 'safe error classification remains stable when persisted');
}
const app = fs.readFileSync(require('node:path').join(__dirname, '../src/App.tsx'), 'utf8');
const widget = fs.readFileSync(require('node:path').join(__dirname, '../desktop-studio.html'), 'utf8');
assert.doesNotMatch(app, /setToast\([^\n]*(?:String\(e\)|e\.message)/, 'no raw errors in toasts');
assert.doesNotMatch(app, /setWebStatus\([^\n]*(?:String\(e\)|e\.message)/, 'no raw errors in web UI status');
assert.doesNotMatch(app, /最近连接问题：\{items\.find\(x=>x\.id===editor\.id\)\?\.error\}/, 'no raw persisted errors in modal');
assert.doesNotMatch(widget, /row\.title\s*=\s*[^\n]*p\.syncError/, 'no raw backend errors in widget tooltip');
console.log('SYNC_DIAGNOSTIC_CLASSIFICATION_NO_SECRET_PASS');
