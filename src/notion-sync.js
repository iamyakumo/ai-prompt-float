/* Notion 同步的纯逻辑（不发请求、不读 chrome.*）
 *
 * 数据库需要三个属性，名称区分大小写：
 *   Title    title      提示词标题
 *   Content  rich_text  提示词正文
 *   PromptId rich_text  本地 id，用来稳定匹配
 *
 * 双向同步（没有 updatedAt）的规则：
 *   1. 拉取只「补缺」：Notion 里本地没有的条目加进本地；同一 PromptId 不覆盖本地正文，只记下 notionPageId
 *   2. 再把本地列表推回 Notion：同一条以本地标题/正文为准
 * 单独的「拉取」会用 Notion 覆盖同一 PromptId 的标题和正文。
 * 没有 PromptId 的行按 notionPageId 匹配，避免重复拉取时不断新建。
 */

const PROP_TYPES = {
  Title: 'title',
  Content: 'rich_text',
  PromptId: 'rich_text',
};

const RICH_TEXT_LIMIT = 2000;
const RICH_TEXT_MAX_CHUNKS = 100;

/** 去掉连字符后的 32 位十六进制，用作比较 */
export function normalizeNotionId(id) {
  if (typeof id !== 'string') return '';
  const hex = id.replace(/-/g, '').trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : '';
}

/**
 * 接受 32 位 ID、带连字符的 UUID，或 Notion 数据库链接。
 * 链接只看路径（忽略 ?v= 视图 ID），取路径里最后一段 32 位 ID。
 */
export function parseDatabaseId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = decodeURIComponent(new URL(raw).pathname);
    } catch (e) {
      path = raw.split(/[?#]/)[0];
    }
  } else {
    path = raw.split(/[?#]/)[0];
  }

  const uuid = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0].replace(/-/g, '').toLowerCase();

  const matches = path.match(/[0-9a-f]{32}/gi);
  if (matches && matches.length) return matches[matches.length - 1].toLowerCase();
  return '';
}

/** 按 2000 字切分，且不把代理对从中间切开。空字符串得到 []。 */
export function richTextChunks(text, size = RICH_TEXT_LIMIT) {
  const s = String(text ?? '');
  const limit = size > 0 ? size : RICH_TEXT_LIMIT;
  const chunks = [];
  let i = 0;
  while (i < s.length && chunks.length < RICH_TEXT_MAX_CHUNKS) {
    let end = Math.min(i + limit, s.length);
    if (end < s.length) {
      const prev = s.charCodeAt(end - 1);
      const next = s.charCodeAt(end);
      if (prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end -= 1;
    }
    if (end <= i) end = Math.min(i + limit, s.length);
    chunks.push({ type: 'text', text: { content: s.slice(i, end) } });
    i = end;
  }
  return chunks;
}

export function plainText(prop) {
  if (!prop || typeof prop !== 'object') return '';
  const parts = Array.isArray(prop.title) ? prop.title : Array.isArray(prop.rich_text) ? prop.rich_text : [];
  let out = '';
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    if (typeof part.plain_text === 'string') out += part.plain_text;
    else if (part.text && typeof part.text.content === 'string') out += part.text.content;
  }
  return out;
}

export function buildProperties(prompt) {
  const title = String((prompt && prompt.title) || '').trim().slice(0, RICH_TEXT_LIMIT) || 'Untitled';
  const content = String((prompt && prompt.content) || '');
  const id = String((prompt && prompt.id) || '');
  return {
    Title: { title: richTextChunks(title) },
    Content: { rich_text: richTextChunks(content) },
    PromptId: { rich_text: richTextChunks(id) },
  };
}

export function pageToPrompt(page) {
  const props = (page && page.properties) || {};
  return {
    pageId: page && page.id ? String(page.id) : '',
    promptId: plainText(props.PromptId).trim(),
    title: plainText(props.Title).trim(),
    content: plainText(props.Content),
  };
}

/** 丢掉归档/回收站页，以及标题和正文都空的行 */
export function rowsFromPages(pages) {
  const rows = [];
  for (const page of pages || []) {
    if (!page || typeof page !== 'object') continue;
    if (page.archived || page.in_trash) continue;
    const row = pageToPrompt(page);
    if (!row.title && !String(row.content || '').trim()) continue;
    rows.push(row);
  }
  return rows;
}

export function validateDatabaseProperties(properties) {
  const props = properties || {};
  const missing = [];
  const wrong = [];
  for (const name of Object.keys(PROP_TYPES)) {
    const prop = props[name];
    if (!prop) missing.push(name);
    else if (prop.type !== PROP_TYPES[name]) wrong.push(name);
  }
  return { missing, wrong };
}

export function sanitizePublicText(text) {
  return String(text || '')
    .replace(/secret_[A-Za-z0-9]+/g, 'secret_…')
    .replace(/ntn_[A-Za-z0-9]+/g, 'ntn_…')
    .replace(/Bearer\s+\S+/gi, 'Bearer …')
    .slice(0, 280);
}

export function mapHttpError(status, notionCode, message) {
  const detail = sanitizePublicText(message);
  const msg = String(message || '');
  if (status === 401) return { code: 'unauthorized', detail };
  if (status === 403) return { code: 'forbidden', detail };
  if (status === 429) return { code: 'rate_limit', detail };
  if (status === 400 && /not a database/i.test(msg)) return { code: 'not_database', detail };
  if (status === 404 || notionCode === 'object_not_found' || /could not find database/i.test(msg)) {
    return { code: 'not_found', detail };
  }
  return { code: 'notion', detail: detail || (status ? 'HTTP ' + status : '') };
}

/** 后台读存储时用：保留 notionPageId，丢掉没有 id 的项 */
export function sanitizePrompts(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const content = typeof item.content === 'string' ? item.content : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || (!content && !title)) continue;
    const prompt = {
      id,
      title: title || content.trim().replace(/\s+/g, ' ').slice(0, 16) || 'Untitled',
      content,
    };
    if (typeof item.notionPageId === 'string' && item.notionPageId.trim()) {
      prompt.notionPageId = item.notionPageId.trim();
    }
    out.push(prompt);
  }
  return out;
}

function clonePrompt(p) {
  const copy = { id: p.id, title: p.title, content: p.content };
  if (p.notionPageId) copy.notionPageId = p.notionPageId;
  return copy;
}

function findByPageId(prompts, pageId) {
  const key = normalizeNotionId(pageId);
  if (!key) return null;
  for (const p of prompts) {
    if (normalizeNotionId(p.notionPageId) === key) return p;
  }
  return null;
}

/**
 * 把 Notion 行合并进本地列表。
 * fillOnly=false（拉取）：同一 PromptId 用远端标题/正文覆盖。
 * fillOnly=true（双向的前半段）：已有条目只补 notionPageId，不改标题/正文。
 * 返回的 counts.updated 是本地被改写正文的条数，pulled 是新补进本地的条数。
 */
export function mergePull(localPrompts, rows, options) {
  const fillOnly = !!(options && options.fillOnly);
  const makeId = (options && options.makeId) || (() => 'p' + Math.random().toString(36).slice(2, 10));
  const prompts = (localPrompts || []).map(clonePrompt);
  const index = new Map();
  for (const p of prompts) if (p && p.id && !index.has(p.id)) index.set(p.id, p);

  let updated = 0;
  let pulled = 0;

  for (const row of rows || []) {
    if (!row) continue;
    const title = String(row.title || '').trim();
    const content = typeof row.content === 'string' ? row.content : '';
    if (!title && !content.trim()) continue;

    const promptId = String(row.promptId || '').trim();
    const pageId = row.pageId ? String(row.pageId) : '';
    let local = promptId ? index.get(promptId) : null;
    if (!local && pageId) local = findByPageId(prompts, pageId);

    if (local) {
      if (pageId) local.notionPageId = pageId;
      if (!fillOnly) {
        const nextTitle = title || content.trim().replace(/\s+/g, ' ').slice(0, 16) || local.title;
        const changed = local.title !== nextTitle || local.content !== content;
        local.title = nextTitle;
        local.content = content;
        if (changed) updated += 1;
      }
      continue;
    }

    let newId = promptId;
    if (!newId) {
      newId = makeId();
      while (index.has(newId)) newId = makeId();
    }
    const prompt = {
      id: newId,
      title: title || content.trim().replace(/\s+/g, ' ').slice(0, 16) || 'Untitled',
      content,
    };
    if (pageId) prompt.notionPageId = pageId;
    prompts.push(prompt);
    index.set(newId, prompt);
    pulled += 1;
  }

  return { prompts, counts: { created: 0, updated, pulled } };
}

/**
 * 推送一条提示词时的尝试顺序（遇 404 才继续，其它错误应中止）：
 *   1. 有 notionPageId → PATCH 该页（索引里有则用索引中的 id）
 *   2. 按 PromptId 还能找到另一页 → PATCH 那一页
 *   3. 否则 POST 创建
 */
export function planPush(prompt, index) {
  const attempts = [];
  const byPageId = (index && index.byPageId) || new Map();
  const byPromptId = (index && index.byPromptId) || new Map();
  const pageKey = normalizeNotionId(prompt && prompt.notionPageId);
  if (prompt && prompt.notionPageId) {
    const known = pageKey ? byPageId.get(pageKey) : null;
    attempts.push({ op: 'patch', pageId: known && known.id ? known.id : prompt.notionPageId });
  }
  const hit = prompt && prompt.id ? byPromptId.get(prompt.id) : null;
  if (hit && hit.id) {
    const hitKey = normalizeNotionId(hit.id);
    const already = attempts.some((step) => normalizeNotionId(step.pageId) === hitKey && hitKey);
    if (!already) attempts.push({ op: 'patch', pageId: hit.id });
  }
  attempts.push({ op: 'create' });
  return attempts;
}

/** 已知的数据库页索引：按页面 ID、按 PromptId */
export function indexPages(pages) {
  const byPageId = new Map();
  const byPromptId = new Map();
  for (const page of pages || []) {
    if (!page || typeof page !== 'object') continue;
    if (page.archived || page.in_trash) continue;
    const key = normalizeNotionId(page.id);
    if (key && !byPageId.has(key)) byPageId.set(key, page);
    const promptId = plainText((page.properties || {}).PromptId).trim();
    if (promptId && !byPromptId.has(promptId)) byPromptId.set(promptId, page);
  }
  return { byPageId, byPromptId };
}
