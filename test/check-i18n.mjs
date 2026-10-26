/* 文案完整性检查（静态）：
 *   1. 代码/HTML 里引用到的每个 i18n key，在 zh 和 en 两份表里都必须存在
 *   2. 两份表的 key 集合必须一致（防止只加了一种语言）
 *   3. manifest 里用到的 __MSG_xxx__ 必须在两份 _locales 里都有
 *
 * 用法：node test/check-i18n.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// 不是文案、但长得像 key 的字符串（存储 key、popup.html 里的文件名引用）
const IGNORE = new Set(['aipf.prompts', 'aipf.settings', 'popup.css', 'popup.js']);

const problems = [];

// ---------- 取出两份表 ----------
const catalogs = {};
for (const lang of ['zh', 'en']) {
  const src = read('src/i18n.js');
  const m = src.match(new RegExp(`const ${lang} = \\{([\\s\\S]*?)\\n  \\};`));
  if (!m) {
    problems.push(`i18n.js 里找不到 ${lang} 文案表`);
    continue;
  }
  const keys = new Set();
  for (const km of m[1].matchAll(/^\s{4}(?:'([^']+)'|([A-Za-z][\w.]*))\s*:/gm)) {
    keys.add(km[1] || km[2]);
  }
  catalogs[lang] = keys;
}

if (catalogs.zh && catalogs.en) {
  for (const k of catalogs.zh) if (!catalogs.en.has(k)) problems.push(`en 缺少 key: ${k}`);
  for (const k of catalogs.en) if (!catalogs.zh.has(k)) problems.push(`zh 缺少 key: ${k}`);
}

const known = catalogs.zh || new Set();

// ---------- 取出被引用的 key ----------
const referenced = new Map(); // key -> 来源
function collect(file) {
  const src = read(file);
  for (const m of src.matchAll(/['"]([a-z][a-zA-Z]*\.[a-zA-Z]+)['"]/g)) {
    const key = m[1];
    if (IGNORE.has(key)) continue;
    if (!referenced.has(key)) referenced.set(key, file);
  }
  // HTML 属性
  for (const m of src.matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], file);
  }
}

for (const f of ['src/content.js', 'src/i18n.js', 'popup.js', 'popup.html']) collect(f);

for (const [key, file] of referenced) {
  if (!known.has(key)) problems.push(`${file} 引用了不存在的 key: ${key}`);
}

// ---------- manifest 的 __MSG_xxx__ ----------
const manifest = read('manifest.json');
const msgKeys = new Set();
for (const m of manifest.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) msgKeys.add(m[1]);
for (const lang of ['zh_CN', 'en']) {
  const locale = JSON.parse(read(`_locales/${lang}/messages.json`));
  for (const k of msgKeys) {
    if (!locale[k] || !locale[k].message) problems.push(`_locales/${lang}/messages.json 缺少 ${k}`);
  }
}
if (msgKeys.size === 0) problems.push('manifest.json 里没有使用 __MSG_...__');

// ---------- 结果 ----------
const used = [...referenced.keys()].length;
console.log(`文案表 key 数：zh=${catalogs.zh ? catalogs.zh.size : 0} en=${catalogs.en ? catalogs.en.size : 0}`);
console.log(`被引用的 key 数：${used}；manifest 用到 ${msgKeys.size} 个 __MSG__`);
if (problems.length) {
  console.log('\nAIPF-I18N FAIL');
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log('\nAIPF-I18N OK — 两份文案表一致，且所有引用的 key 都存在');
