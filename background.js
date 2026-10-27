/* MV3 service worker：唯一会请求 api.notion.com 的地方。
 *
 * 内容脚本和弹窗通过 chrome.runtime.sendMessage({ type: 'aipf:notion-sync', mode }) 触发。
 * 令牌和数据库 ID 从 chrome.storage.local 的 aipf.settings.notion 读取，不从消息里带，
 * 也不要写进日志或错误文案。
 *
 * mode:
 *   push  本地 → Notion（有 notionPageId 则 PATCH，否则按 PromptId 查找，再否则创建）
 *   pull  Notion → 本地（同一 PromptId 覆盖标题和正文）
 *   both  先补缺再推送：同一 PromptId 以本地为准写回 Notion
 */

import {
  parseDatabaseId,
  validateDatabaseProperties,
  rowsFromPages,
  mergePull,
  sanitizePrompts,
  buildProperties,
  indexPages,
  planPush,
  mapHttpError,
  sanitizePublicText,
} from './src/notion-sync.js';

const KEY_PROMPTS = 'aipf.prompts';
const KEY_SETTINGS = 'aipf.settings';
const NOTION_VERSION = '2022-06-28';
const NOTION_BASE = 'https://api.notion.com/v1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactSecret(text, token) {
  const s = sanitizePublicText(text);
  if (!token || token.length < 8) return s;
  return s.split(token).join('…');
}

function fail(code, detail, status) {
  const err = new Error(code);
  err.aipfCode = code;
  err.detail = sanitizePublicText(detail || '');
  if (status) err.status = status;
  return err;
}

async function notionFetch(token, path, options) {
  const method = (options && options.method) || 'GET';
  const headers = {
    Authorization: 'Bearer ' + token,
    'Notion-Version': NOTION_VERSION,
  };
  let body;
  if (options && Object.prototype.hasOwnProperty.call(options, 'body')) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(NOTION_BASE + path, { method, headers, body });
    } catch (e) {
      throw fail('network', '');
    }

    if (res.status === 429 && attempt < maxAttempts - 1) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 700 * (attempt + 1);
      await sleep(Math.min(wait, 8000));
      continue;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const mapped = mapHttpError(res.status, data && data.code, (data && data.message) || '');
      throw fail(mapped.code, redactSecret(mapped.detail, token), res.status);
    }
    return data || {};
  }
  throw fail('rate_limit', '');
}

async function loadDatabase(token, databaseId) {
  const db = await notionFetch(token, '/databases/' + encodeURIComponent(databaseId), { method: 'GET' });
  const check = validateDatabaseProperties(db.properties);
  if (check.missing.length) {
    throw fail('missing_props', check.missing.join(', '));
  }
  if (check.wrong.length) {
    throw fail('wrong_type', check.wrong.join(', '));
  }
  return db;
}

async function queryAllPages(token, databaseId) {
  const pages = [];
  let cursor = '';
  for (let guard = 0; guard < 100; guard++) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch(token, '/databases/' + encodeURIComponent(databaseId) + '/query', {
      method: 'POST',
      body,
    });
    const batch = Array.isArray(data.results) ? data.results : [];
    for (const page of batch) pages.push(page);
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return pages;
}

async function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

async function persist(prompts, notionPatch) {
  const cur = await storageGet(KEY_SETTINGS);
  const settings = Object.assign({}, cur[KEY_SETTINGS] || {});
  settings.notion = Object.assign({}, settings.notion || {}, notionPatch);
  const payload = { [KEY_SETTINGS]: settings };
  if (prompts) payload[KEY_PROMPTS] = prompts;
  await chrome.storage.local.set(payload);
}

function statusPatch(mode, ok, code, detail, counts) {
  return {
    lastSyncAt: new Date().toISOString(),
    lastSyncAction: mode,
    lastSyncOk: !!ok,
    lastErrorCode: ok ? '' : code || 'notion',
    lastErrorDetail: ok ? '' : sanitizePublicText(detail || ''),
    lastCounts: {
      created: counts && counts.created ? counts.created : 0,
      updated: counts && counts.updated ? counts.updated : 0,
      pulled: counts && counts.pulled ? counts.pulled : 0,
    },
  };
}

function isMissingPage(err) {
  return !!(err && (err.aipfCode === 'not_found' || err.status === 404));
}

async function pushOne(token, databaseId, prompt, index) {
  const props = buildProperties(prompt);
  const attempts = planPush(prompt, index);

  for (const step of attempts) {
    if (step.op === 'create') {
      const created = await notionFetch(token, '/pages', {
        method: 'POST',
        body: {
          parent: { database_id: databaseId },
          properties: props,
        },
      });
      prompt.notionPageId = created.id;
      if (created.id) index.byPromptId.set(prompt.id, created);
      return 'created';
    }

    try {
      const page = await notionFetch(token, '/pages/' + encodeURIComponent(step.pageId), {
        method: 'PATCH',
        body: { properties: props },
      });
      prompt.notionPageId = (page && page.id) || step.pageId;
      return 'updated';
    } catch (err) {
      if (!isMissingPage(err)) throw err;
      delete prompt.notionPageId;
    }
  }

  throw fail('notion', '');
}

async function pushAll(token, databaseId, prompts, pages) {
  const index = indexPages(pages);
  let created = 0;
  let updated = 0;
  for (let i = 0; i < prompts.length; i++) {
    try {
      const kind = await pushOne(token, databaseId, prompts[i], index);
      if (kind === 'created') created += 1;
      else updated += 1;
    } catch (err) {
      err.pushCounts = { created, updated };
      throw err;
    }
    if (i < prompts.length - 1) await sleep(120);
  }
  return { created, updated };
}

async function run(msg) {
  const mode = msg && msg.mode;
  if (mode !== 'push' && mode !== 'pull' && mode !== 'both') {
    return { ok: false, code: 'unknown', detail: '', persisted: false, mode: mode || '' };
  }

  const stored = await storageGet([KEY_PROMPTS, KEY_SETTINGS]);
  const notion = (stored[KEY_SETTINGS] && stored[KEY_SETTINGS].notion) || {};
  const token = typeof notion.token === 'string' ? notion.token.trim() : '';
  const databaseId = parseDatabaseId(notion.databaseId);

  if (!token) {
    const counts = { created: 0, updated: 0, pulled: 0 };
    await persist(null, statusPatch(mode, false, 'need_token', '', counts));
    return { ok: false, code: 'need_token', detail: '', persisted: true, mode, counts };
  }
  if (!databaseId) {
    const counts = { created: 0, updated: 0, pulled: 0 };
    const rawDb = typeof notion.databaseId === 'string' ? notion.databaseId.trim() : '';
    const code = rawDb ? 'bad_db' : 'need_db';
    await persist(null, statusPatch(mode, false, code, '', counts));
    return { ok: false, code, detail: '', persisted: true, mode, counts };
  }

  let prompts = sanitizePrompts(stored[KEY_PROMPTS]);
  let counts = { created: 0, updated: 0, pulled: 0 };
  let promptsDirty = false;

  try {
    await loadDatabase(token, databaseId);
    const pages = await queryAllPages(token, databaseId);

    if (mode === 'pull' || mode === 'both') {
      const merged = mergePull(prompts, rowsFromPages(pages), { fillOnly: mode === 'both' });
      prompts = merged.prompts;
      counts.pulled = merged.counts.pulled;
      if (mode === 'pull') counts.updated = merged.counts.updated;
      promptsDirty = true;
    }

    if (mode === 'push' || mode === 'both') {
      const pushed = await pushAll(token, databaseId, prompts, pages);
      counts.created = pushed.created;
      counts.updated = pushed.updated;
      if (mode === 'push') counts.pulled = 0;
      promptsDirty = true;
    }

    await persist(prompts, statusPatch(mode, true, '', '', counts));
    return { ok: true, mode, counts, persisted: true };
  } catch (err) {
    const code = (err && err.aipfCode) || 'notion';
    const detail = redactSecret((err && err.detail) || '', token);
    const partial = err && err.pushCounts;
    if (partial) {
      counts.created = partial.created || 0;
      counts.updated = partial.updated || 0;
      if ((partial.created || 0) + (partial.updated || 0) > 0) promptsDirty = true;
    }
    try {
      await persist(promptsDirty ? prompts : null, statusPatch(mode, false, code, detail, counts));
    } catch (e) {
      return { ok: false, code, detail, persisted: false, mode, counts };
    }
    return { ok: false, code, detail, persisted: true, mode, counts };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'aipf:notion-sync') return undefined;
  run(msg).then(
    (resp) => sendResponse(resp),
    () => sendResponse({ ok: false, code: 'unknown', detail: '', persisted: false })
  );
  return true;
});
