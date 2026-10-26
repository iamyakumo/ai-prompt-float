/* Notion 同步纯逻辑 + 清单/后台的静态约束。不访问网络。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDatabaseId,
  normalizeNotionId,
  richTextChunks,
  plainText,
  buildProperties,
  pageToPrompt,
  rowsFromPages,
  validateDatabaseProperties,
  sanitizePublicText,
  mapHttpError,
  sanitizePrompts,
  mergePull,
  indexPages,
  planPush,
} from '../src/notion-sync.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');

const DB = 'a1b2c3d4e5f6789012345678abcdef01';
const VIEW = '1234567890abcdef1234567890abcdef';

function page(id, promptId, title, content, extra) {
  return Object.assign({
    object: 'page',
    id,
    properties: {
      Title: { title: [{ plain_text: title }] },
      Content: { rich_text: [{ plain_text: content }] },
      PromptId: { rich_text: [{ plain_text: promptId }] },
    },
  }, extra || {});
}

// ---------- 数据库 ID ----------
assert.equal(parseDatabaseId(DB), DB);
assert.equal(parseDatabaseId('  ' + DB.toUpperCase() + '  '), DB);
assert.equal(parseDatabaseId('a1b2c3d4-e5f6-7890-1234-5678abcdef01'), 'a1b2c3d4e5f6789012345678abcdef01');
assert.equal(
  parseDatabaseId(`https://www.notion.so/workspace/Prompts-${DB}?v=${VIEW}`),
  DB
);
assert.equal(parseDatabaseId(`https://www.notion.so/${DB}?v=${VIEW}&pvs=21`), DB);
assert.equal(parseDatabaseId(`https://notion.so/${DB}#comments`), DB);
assert.equal(parseDatabaseId('not-a-database'), '');
assert.equal(parseDatabaseId(''), '');
assert.equal(normalizeNotionId('A1B2C3D4-E5F6-7890-1234-5678ABCDEF01'), 'a1b2c3d4e5f6789012345678abcdef01');
assert.equal(normalizeNotionId('short'), '');

// ---------- 富文本切分与属性 ----------
const long = 'x'.repeat(2000) + 'y'.repeat(10);
const chunks = richTextChunks(long);
assert.equal(chunks.length, 2);
assert.equal(chunks[0].text.content.length, 2000);
assert.equal(chunks[1].text.content, 'y'.repeat(10));
assert.deepEqual(richTextChunks(''), []);

const emoji = '😀'.repeat(3);
const emojiChunks = richTextChunks(emoji, 2);
assert.equal(emojiChunks.map((c) => c.text.content).join(''), emoji);
for (const chunk of emojiChunks) {
  const codes = [...chunk.text.content].join('');
  assert.equal(codes, chunk.text.content);
}

const props = buildProperties({ id: 'p1', title: 'Hi', content: long });
assert.equal(plainText(props.Title), 'Hi');
assert.equal(plainText(props.Content), long);
assert.equal(plainText(props.PromptId), 'p1');
assert.equal(plainText(buildProperties({ id: 'p', title: '  ', content: '' }).Title), 'Untitled');

const schemaOk = {
  Title: { type: 'title' },
  Content: { type: 'rich_text' },
  PromptId: { type: 'rich_text' },
};
assert.deepEqual(validateDatabaseProperties(schemaOk), { missing: [], wrong: [] });
assert.deepEqual(validateDatabaseProperties({ Title: { type: 'title' } }).missing, ['Content', 'PromptId']);
assert.deepEqual(
  validateDatabaseProperties({
    Title: { type: 'rich_text' },
    Content: { type: 'rich_text' },
    PromptId: { type: 'title' },
  }).wrong,
  ['Title', 'PromptId']
);

const extracted = pageToPrompt(page('page-1', 'local-1', '标题', '正文'));
assert.deepEqual(extracted, { pageId: 'page-1', promptId: 'local-1', title: '标题', content: '正文' });

const rows = rowsFromPages([
  page('page-1', 'local-1', '标题', '正文'),
  page('page-arch', 'x', '归档', 'no', { archived: true }),
  page('page-trash', 'y', '垃圾', 'no', { in_trash: true }),
  page('page-empty', '', '', '   '),
]);
assert.equal(rows.length, 1);
assert.equal(rows[0].pageId, 'page-1');

// ---------- 拉取 / 双向合并 ----------
const local = [
  { id: 'keep', title: '本地标题', content: '本地正文', notionPageId: 'old-page' },
  { id: 'only-local', title: '只在本地', content: 'stay' },
];
const remoteRows = [
  { pageId: '11111111-1111-1111-1111-111111111111', promptId: 'keep', title: '远端标题', content: '远端正文' },
  { pageId: '22222222-2222-2222-2222-222222222222', promptId: '', title: '无 ID', content: '新正文' },
  { pageId: '33333333-3333-3333-3333-333333333333', promptId: 'from-notion', title: '来自 Notion', content: 'phone' },
];

const pulled = mergePull(local, remoteRows, { fillOnly: false, makeId: () => 'generated' });
assert.equal(pulled.prompts.length, 4);
assert.equal(pulled.prompts[0].title, '远端标题');
assert.equal(pulled.prompts[0].content, '远端正文');
assert.equal(pulled.prompts[0].notionPageId, '11111111-1111-1111-1111-111111111111');
assert.equal(pulled.prompts[1].title, '只在本地');
assert.equal(pulled.prompts[2].id, 'generated');
assert.equal(pulled.prompts[2].notionPageId, '22222222-2222-2222-2222-222222222222');
assert.equal(pulled.prompts[3].id, 'from-notion');
assert.equal(pulled.counts.pulled, 2);
assert.equal(pulled.counts.updated, 1);

const again = mergePull(pulled.prompts, remoteRows, { fillOnly: false, makeId: () => 'should-not-use' });
assert.equal(again.prompts.length, 4);
assert.equal(again.counts.pulled, 0);

const both = mergePull(local, remoteRows, { fillOnly: true, makeId: () => 'generated-2' });
assert.equal(both.prompts[0].title, '本地标题');
assert.equal(both.prompts[0].content, '本地正文');
assert.equal(both.prompts[0].notionPageId, '11111111-1111-1111-1111-111111111111');
assert.equal(both.prompts[1].content, 'stay');
assert.equal(both.counts.updated, 0);
assert.equal(both.counts.pulled, 2);
assert.equal(both.prompts[3].id, 'from-notion');

const sanitized = sanitizePrompts([
  { id: 'p', title: 'T', content: 'C', notionPageId: ' abc ' },
  { id: '', title: 'drop', content: 'me' },
  { title: 'no-id', content: 'x' },
]);
assert.equal(sanitized.length, 1);
assert.equal(sanitized[0].notionPageId, 'abc');

// ---------- 推送计划 ----------
const pages = [
  page('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'keep', '远端标题', '远端正文'),
  page('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other', '别的', 'body'),
];
const index = indexPages(pages);
const known = planPush({ id: 'keep', notionPageId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, index);
assert.deepEqual(known.map((s) => s.op), ['patch', 'create']);
assert.equal(known[0].pageId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

const stale = planPush(
  { id: 'keep', notionPageId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
  index
);
assert.deepEqual(stale.map((s) => s.op), ['patch', 'patch', 'create']);
assert.equal(normalizeNotionId(stale[0].pageId), 'cccccccccccccccccccccccccccccccc');
assert.equal(stale[1].pageId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

const linkOnly = planPush({ id: 'other', title: 'L', content: 'c' }, index);
assert.deepEqual(linkOnly.map((s) => s.op), ['patch', 'create']);
assert.equal(linkOnly[0].pageId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

const create = planPush({ id: 'brand-new', title: 'N', content: 'c' }, index);
assert.deepEqual(create, [{ op: 'create' }]);

// ---------- 错误文案不得带上令牌 ----------
const secret = 'secret_abcdefghijklmnopqrstuvwxyz';
assert.equal(sanitizePublicText('bad ' + secret + ' token'), 'bad secret_… token');
assert.equal(sanitizePublicText('Authorization: Bearer ' + secret), 'Authorization: Bearer …');
const mapped = mapHttpError(401, 'unauthorized', 'bad ' + secret);
assert.equal(mapped.code, 'unauthorized');
assert.equal(mapped.detail.includes(secret), false);
assert.equal(mapHttpError(404, 'object_not_found', 'missing').code, 'not_found');
assert.equal(mapHttpError(400, 'validation_error', 'Provided ID is a page, not a database').code, 'not_database');
assert.equal(mapHttpError(429, 'rate_limited', 'slow down').code, 'rate_limit');
assert.equal(mapHttpError(500, 'internal', '').code, 'notion');

// ---------- 扩展清单与后台边界 ----------
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '1.2.0');
assert.equal(manifest.background.service_worker, 'background.js');
assert.equal(manifest.background.type, 'module');
assert.ok(manifest.host_permissions.includes('https://api.notion.com/*'));
assert.ok(manifest.permissions.includes('storage'));

const background = read('background.js');
assert.match(background, /2022-06-28/);
assert.match(background, /https:\/\/api\.notion\.com\/v1/);
assert.match(background, /aipf:notion-sync/);
assert.doesNotMatch(background, /console\.(log|debug|info|warn|error)/);
assert.equal(background.includes(secret), false);

const content = read('src/content.js');
assert.match(content, /aipf:notion-sync/);
assert.match(content, /notion-push/);
assert.match(content, /notion-pull/);
assert.match(content, /notion-both/);
assert.doesNotMatch(content, /fetch\s*\(/);

console.log('notion-sync tests OK');
