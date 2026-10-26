/* AI 提示词浮窗 —— 输入框定位与文本插入核心
 *
 * 这个文件刻意不依赖任何 chrome.* API，方便在测试页里直接引入验证。
 * 对外暴露：globalThis.AIPF = { findEditor, candidates, insert, readValue, siteRule, ... }
 *
 * 支持的编辑器形态：
 *   - 原生 <textarea>（Grok 旧版 / 部分站点）
 *   - React 受控 <textarea>（需要走原生 value setter + input 事件）
 *   - contenteditable（ChatGPT 的 ProseMirror、Gemini 的 Quill、Kimi 的自研编辑器）
 */
(function () {
  'use strict';

  const NS = (globalThis.AIPF = globalThis.AIPF || {});
  if (NS.__insertReady) return;

  const EDITABLE_SEL =
    'textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

  /** 站点专用选择器：优先命中，避免误插到搜索框、重命名框等其它输入区 */
  const SITE_RULES = [
    {
      name: 'ChatGPT',
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i,
      selectors: [
        '#prompt-textarea',
        'form [contenteditable="true"]',
        'main form textarea',
        'form textarea',
      ],
    },
    {
      name: 'Gemini',
      host: /(^|\.)gemini\.google\.com$/i,
      selectors: [
        'rich-textarea .ql-editor',
        'rich-textarea [contenteditable="true"]',
        '.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"]',
      ],
    },
    {
      name: 'Grok',
      host: /(^|\.)grok\.com$/i,
      selectors: [
        'textarea[aria-label]',
        'form textarea',
        'div[contenteditable="true"]',
      ],
    },
    {
      name: 'Grok on X',
      host: /(^|\.)x\.com$/i,
      selectors: ['div[contenteditable="true"]', 'textarea'],
    },
    {
      name: 'Kimi',
      host: /(^|\.)kimi\.com$|(^|\.)kimi\.moonshot\.cn$|(^|\.)moonshot\.cn$/i,
      selectors: [
        '[data-testid="chat-input"] [contenteditable="true"]',
        '.chat-input-editor',
        '[class*="editor"][contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea',
      ],
    },
  ];

  // ---------------------------------------------------------------- 定位

  function siteRule(host) {
    const h = host || (typeof location !== 'undefined' ? location.hostname : '');
    for (const rule of SITE_RULES) {
      if (rule.host.test(h)) return rule;
    }
    return null;
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel', ''].indexOf(type) >= 0;
    }
    return el.isContentEditable === true;
  }

  function isVisible(el) {
    if (!el || !el.getClientRects || el.getClientRects().length === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 10) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) === 0) return false;
    if (cs.pointerEvents === 'none' && cs.userSelect === 'none') return false;
    // 完全在视口之外（例如被折叠的历史输入框）不算
    const vh = window.innerHeight || 800;
    if (rect.bottom < 0 || rect.top > vh + 400) return false;
    return true;
  }

  /** 打分：优先当前聚焦的、位于屏幕下半部分、面积大、靠近底部的编辑区 */
  function score(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    let s = 0;

    // 当前聚焦的编辑区优先（用户的打字光标就在那儿），但要排除顶部的搜索框之类
    const active = document.activeElement;
    const isFocused = active === el || !!(active && el.contains && el.contains(active));
    const inLowerArea = rect.top + rect.height / 2 > vh * 0.25;
    if (isFocused) {
      s += el.tagName === 'INPUT' || !inLowerArea ? 1e4 : 1e6;
    }

    const centerY = rect.top + rect.height / 2;
    if (centerY > vh * 0.35) s += 20000 * (centerY / vh);

    s += (Math.min(rect.width, 1400) * Math.min(rect.height, 500)) / 200;
    s -= Math.abs(vh - rect.bottom) * 1.5;
    if (el.tagName === 'INPUT') s -= 100000;
    return s;
  }

  function pickBest(list) {
    let bestEl = null;
    let bestScore = -Infinity;
    for (const el of list) {
      const s = score(el);
      if (s > bestScore) {
        bestScore = s;
        bestEl = el;
      }
    }
    return bestEl;
  }

  function candidates() {
    const out = [];
    const seen = new Set();

    const push = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      if (!isEditable(el) || !isVisible(el)) return;
      // 浮窗自身（Shadow DOM 里的编辑框）不参与
      if (el.closest && el.closest('[data-aipf-root]')) return;
      out.push(el);
    };

    const rule = siteRule();
    if (rule) {
      for (const sel of rule.selectors) {
        let nodes = [];
        try {
          nodes = document.querySelectorAll(sel);
        } catch (e) {
          nodes = [];
        }
        for (const el of nodes) push(el);
      }
    }

    try {
      for (const el of document.querySelectorAll(EDITABLE_SEL)) push(el);
    } catch (e) {
      /* ignore */
    }

    return out;
  }

  function findEditor() {
    return pickBest(candidates());
  }

  // ---------------------------------------------------------------- 读取

  function readValue(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
    return typeof el.innerText === 'string' ? el.innerText : el.textContent || '';
  }

  // ---------------------------------------------------------------- 写入

  function nativeSetValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function selectionRange(el) {
    try {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      if (typeof s === 'number' && typeof e === 'number') return [s, e];
    } catch (err) {
      /* 某些 input type 不支持 selection */
    }
    const len = (el.value || '').length;
    return [len, len];
  }

  function execInsertText(text) {
    try {
      return document.execCommand('insertText', false, text) === true;
    } catch (e) {
      return false;
    }
  }

  function collapsableSelection() {
    const sel = window.getSelection();
    if (!sel) return null;
    const range = document.createRange();
    return { sel, range };
  }

  function placeCaretAtEnd(el) {
    const ctx = collapsableSelection();
    if (!ctx) return;
    ctx.range.selectNodeContents(el);
    ctx.range.collapse(false);
    ctx.sel.removeAllRanges();
    ctx.sel.addRange(ctx.range);
  }

  function selectAllContents(el) {
    const ctx = collapsableSelection();
    if (!ctx) return;
    ctx.range.selectNodeContents(el);
    ctx.sel.removeAllRanges();
    ctx.sel.addRange(ctx.range);
  }

  function pasteInto(el, text) {
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const ev = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      el.dispatchEvent(ev);
      return true;
    } catch (e) {
      return false;
    }
  }

  function textareaInsert(el, text, mode) {
    const prev = el.value || '';
    const [selStart, selEnd] = selectionRange(el);

    let from;
    let to;
    if (mode === 'replace') {
      from = 0;
      to = prev.length;
    } else if (selStart !== selEnd) {
      from = selStart;
      to = selEnd;
    } else {
      from = prev.length;
      to = prev.length;
    }

    el.focus();
    try {
      el.setSelectionRange(from, to);
    } catch (e) {
      /* ignore */
    }

    if (text && execInsertText(text) && el.value !== prev) {
      // execCommand 走的是原生路径，React 的 onChange 能正常感知
      return true;
    }

    const next = prev.slice(0, from) + text + prev.slice(to);
    nativeSetValue(el, next);
    try {
      el.setSelectionRange(from + text.length, from + text.length);
    } catch (e) {
      /* ignore */
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function contentEditableInsert(el, text, mode) {
    if (!text) return true;
    const before = readValue(el);

    el.focus();
    if (mode === 'replace') selectAllContents(el);
    else placeCaretAtEnd(el);

    let ok = execInsertText(text);
    if (!ok || readValue(el) === before) {
      // ChatGPT / Kimi 这类编辑器在部分情况下会拦截 execCommand，退回粘贴事件
      pasteInto(el, text);
    }
    if (readValue(el) === before) {
      // 最后兜底：直接改 DOM 并补发 input 事件，至少保证内容进了输入框
      if (mode === 'replace') el.textContent = text;
      else el.appendChild(document.createTextNode(text));
      try {
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', data: text })
        );
      } catch (e) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return readValue(el) !== before;
  }

  /**
   * 把文本填进聊天输入框。
   * @param {string} text
   * @param {{mode?: 'append'|'replace', target?: Element}} [opts]
   * @returns {{ok: boolean, reason: string, el: Element|null}}
   */
  function insert(text, opts) {
    const options = Object.assign({ mode: 'append' }, opts || {});
    const el = options.target || findEditor();
    if (!el) {
      return { ok: false, reason: 'not-found', el: null };
    }
    let ok = false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      ok = textareaInsert(el, text, options.mode);
    } else {
      ok = contentEditableInsert(el, text, options.mode);
    }
    return { ok: !!ok, reason: ok ? 'ok' : 'failed', el };
  }

  NS.__insertReady = true;
  NS.SITE_RULES = SITE_RULES;
  NS.siteRule = siteRule;
  NS.isEditable = isEditable;
  NS.isVisible = isVisible;
  NS.candidates = candidates;
  NS.findEditor = findEditor;
  NS.readValue = readValue;
  NS.insert = insert;
})();
