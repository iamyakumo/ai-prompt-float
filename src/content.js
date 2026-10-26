/* AI 提示词浮窗 —— 浮窗 UI 与交互
 *
 * 依赖：i18n.js（文案表）、panel-style.js（样式）、insert.js（插入核心）
 * 数据全部存在 chrome.storage.local，多标签页自动同步。
 * 不预置任何提示词：首次安装列表为空，由用户新建或导入 JSON。
 */
(function () {
  'use strict';
  if (globalThis.__AIPF_CONTENT__) return;
  globalThis.__AIPF_CONTENT__ = true;

  const NS = globalThis.AIPF || {};
  const CSS = globalThis.AIPF_CSS || '';
  const I18N = globalThis.AIPF_I18N || null;

  const KEY_PROMPTS = 'aipf.prompts';
  const KEY_SETTINGS = 'aipf.settings';

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'append', // append | replace
    theme: 'auto', // auto | light | dark
    lang: 'auto', // auto | zh | en
    autoHide: true,
    pos: { right: 22, bottom: 96 },
    open: false,
  };

  const state = {
    prompts: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
  };

  // 首次加载完成（提示词与设置就绪）后才允许响应 popup 的消息
  let readyResolve = null;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });

  // ------------------------------------------------------------ 文案

  let lang = 'en';
  let t = (key) => key;

  function applyLang() {
    lang = I18N ? I18N.resolve(state.settings.lang) : state.settings.lang === 'zh' ? 'zh' : 'en';
    t = I18N ? I18N.make(lang) : (key) => key;
    if (host) host.setAttribute('data-lang', lang);
  }

  /** 把 PANEL_HTML 里带 data-i18n* 标记的节点填上文案 */
  function localize(root) {
    if (!root) return;
    for (const node of root.querySelectorAll('[data-i18n]')) {
      node.textContent = t(node.getAttribute('data-i18n'));
    }
    for (const node of root.querySelectorAll('[data-i18n-title]')) {
      node.title = t(node.getAttribute('data-i18n-title'));
    }
    for (const node of root.querySelectorAll('[data-i18n-ph]')) {
      node.placeholder = t(node.getAttribute('data-i18n-ph'));
    }
  }

  // ------------------------------------------------------------ 存储

  const hasChromeStorage = !!(globalThis.chrome && chrome.storage && chrome.storage.local);

  function storeGet(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    return new Promise((resolve) => {
      if (hasChromeStorage) {
        try {
          chrome.storage.local.get(list, (res) => {
            if (globalThis.chrome && chrome.runtime && chrome.runtime.lastError) {
              resolve(readLocal(list));
              return;
            }
            resolve(res || {});
          });
          return;
        } catch (e) {
          /* 扩展重载后 context 失效，退回 localStorage */
        }
      }
      resolve(readLocal(list));
    });
  }

  function readLocal(list) {
    const out = {};
    for (const key of list) {
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) out[key] = JSON.parse(raw);
      } catch (e) {
        /* ignore */
      }
    }
    return out;
  }

  function storeSet(obj) {
    if (hasChromeStorage) {
      try {
        chrome.storage.local.set(obj);
        return;
      } catch (e) {
        /* fallthrough */
      }
    }
    for (const key in obj) {
      try {
        localStorage.setItem(key, JSON.stringify(obj[key]));
      } catch (e) {
        /* ignore */
      }
    }
  }

  const savePrompts = () => storeSet({ [KEY_PROMPTS]: state.prompts });
  const saveSettings = () => storeSet({ [KEY_SETTINGS]: state.settings });

  // ------------------------------------------------------------ 工具

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalizePrompts(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (!item) continue;
      const content = typeof item.content === 'string' ? item.content : '';
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '';
      if (!content && !title) continue;
      out.push({
        id: typeof item.id === 'string' && item.id ? item.id : uid(),
        title: title || content.slice(0, 16) || t('common.untitled'),
        content,
      });
    }
    return out;
  }

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (attrs[k] == null) continue;
        if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function preview(text) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return flat.length > 90 ? flat.slice(0, 90) + '…' : flat;
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function findPrompt(id) {
    return state.prompts.filter((p) => p.id === id)[0] || null;
  }

  // ------------------------------------------------------------ DOM 引用

  let host = null;
  let shadow = null;
  let ballEl = null;
  let panelEl = null;
  let toastEl = null;
  let listEl = null;
  let emptyEl = null;
  let countEl = null;
  let searchEl = null;
  let modeEl = null;
  let editTitleEl = null;
  let editContentEl = null;
  let fileInputEl = null;
  let settingsViewEl = null;

  let view = 'list';
  let editingId = null;
  let toastTimer = 0;

  const BALL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 12.2c0 4.1-3.6 7.4-8 7.4-1 0-2-.2-2.9-.5L5 21l1.1-3.4A7 7 0 0 1 4.5 12c0-4.1 3.6-7.4 8-7.4s8 3.3 8 7.6z"/>' +
    '<path d="M9 10.8h6M9 14h4"/></svg>';

  const PANEL_HTML = [
    '<div class="aipf-panel" hidden>',
    '  <div class="aipf-head">',
    '    <div class="aipf-title"><span class="aipf-dot"></span><span data-i18n="panel.title"></span>',
    '      <span class="aipf-count"></span></div>',
    '    <div class="aipf-head-actions">',
    '      <button class="aipf-icon" data-act="new" data-i18n-title="panel.add">＋</button>',
    '      <button class="aipf-icon" data-act="settings" data-i18n-title="panel.settings">⚙</button>',
    '      <button class="aipf-icon" data-act="close" data-i18n-title="panel.close">✕</button>',
    '    </div>',
    '  </div>',
    '  <div class="aipf-view" data-view="list">',
    '    <div class="aipf-search">',
    '      <input type="text" class="aipf-search-input" data-i18n-ph="panel.search" spellcheck="false">',
    '      <span class="aipf-mode" data-act="toggle-mode"></span>',
    '    </div>',
    '    <div class="aipf-list"></div>',
    '    <div class="aipf-empty" hidden></div>',
    '  </div>',
    '  <div class="aipf-view" data-view="edit" hidden>',
    '    <div class="aipf-form">',
    '      <div class="aipf-label" data-i18n="edit.titleLabel"></div>',
    '      <input type="text" class="aipf-input" data-field="title" maxlength="40" data-i18n-ph="edit.titlePh">',
    '      <div class="aipf-label" data-i18n="edit.contentLabel"></div>',
    '      <textarea class="aipf-textarea" data-field="content" spellcheck="false"',
    '        data-i18n-ph="edit.contentPh"></textarea>',
    '      <div class="aipf-row aipf-row-between">',
    '        <span class="aipf-hint" data-role="edit-hint"></span>',
    '        <span class="aipf-row">',
    '          <button class="aipf-btn ghost" data-act="cancel-edit" data-i18n="edit.cancel"></button>',
    '          <button class="aipf-btn" data-act="save-edit" data-i18n="edit.save"></button>',
    '        </span>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="aipf-view" data-view="settings" hidden>',
    '    <div class="aipf-settings">',
    '      <div class="aipf-group">',
    '        <div class="aipf-label" data-i18n="settings.mode"></div>',
    '        <label class="aipf-radio"><input type="radio" name="aipf-mode" value="append" data-act="set-mode">',
    '          <span><span data-i18n="settings.append"></span>',
    '          <small data-i18n="settings.appendDesc"></small></span></label>',
    '        <label class="aipf-radio"><input type="radio" name="aipf-mode" value="replace" data-act="set-mode">',
    '          <span><span data-i18n="settings.replace"></span>',
    '          <small data-i18n="settings.replaceDesc"></small></span></label>',
    '      </div>',
    '      <div class="aipf-group">',
    '        <label class="aipf-radio"><input type="checkbox" data-act="toggle-autohide">',
    '          <span><span data-i18n="settings.autoHide"></span>',
    '          <small data-i18n="settings.autoHideDesc"></small></span></label>',
    '      </div>',
    '      <div class="aipf-group">',
    '        <div class="aipf-label" data-i18n="settings.language"></div>',
    '        <div class="aipf-actions">',
    '          <button class="aipf-btn ghost" data-act="set-lang" data-value="auto" data-i18n="settings.langAuto"></button>',
    '          <button class="aipf-btn ghost" data-act="set-lang" data-value="zh" data-i18n="settings.langZh"></button>',
    '          <button class="aipf-btn ghost" data-act="set-lang" data-value="en" data-i18n="settings.langEn"></button>',
    '        </div>',
    '      </div>',
    '      <div class="aipf-group">',
    '        <div class="aipf-label" data-i18n="settings.theme"></div>',
    '        <div class="aipf-actions">',
    '          <button class="aipf-btn ghost" data-act="set-theme" data-value="auto" data-i18n="settings.themeAuto"></button>',
    '          <button class="aipf-btn ghost" data-act="set-theme" data-value="light" data-i18n="settings.themeLight"></button>',
    '          <button class="aipf-btn ghost" data-act="set-theme" data-value="dark" data-i18n="settings.themeDark"></button>',
    '        </div>',
    '      </div>',
    '      <div class="aipf-sep"></div>',
    '      <div class="aipf-group">',
    '        <div class="aipf-label" data-i18n="settings.data"></div>',
    '        <div class="aipf-actions">',
    '          <button class="aipf-btn ghost" data-act="export" data-i18n="settings.export"></button>',
    '          <button class="aipf-btn ghost" data-act="import" data-i18n="settings.import"></button>',
    '          <button class="aipf-btn ghost danger" data-act="clear-all" data-i18n="settings.clear"></button>',
    '        </div>',
    '        <div class="aipf-hint" data-i18n="settings.dataHint"></div>',
    '      </div>',
    '      <div class="aipf-group">',
    '        <div class="aipf-label" data-i18n="settings.other"></div>',
    '        <div class="aipf-actions">',
    '          <button class="aipf-btn ghost" data-act="reset-pos" data-i18n="settings.resetPos"></button>',
    '          <button class="aipf-btn ghost" data-act="back" data-i18n="settings.back"></button>',
    '        </div>',
    '        <div class="aipf-hint" data-i18n="settings.otherHint"></div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="aipf-foot">',
    '    <span data-i18n="foot.hint"></span>',
    '    <span class="aipf-kbd">Alt+P</span>',
    '  </div>',
    '</div>',
  ].join('\n');

  // ------------------------------------------------------------ 构建

  function buildUI() {
    if (host) return;

    host = document.createElement('div');
    host.setAttribute('data-aipf-root', '');
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.zIndex = '2147483647';
    host.setAttribute('data-theme', state.settings.theme || 'auto');
    host.setAttribute('data-lang', lang);

    shadow = host.attachShadow({ mode: 'open' });

    // 用 constructable stylesheet 注入样式：不受页面 CSP 限制，也不会污染站点
    let styled = false;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      shadow.adoptedStyleSheets = [sheet];
      styled = true;
    } catch (e) {
      styled = false;
    }
    if (!styled) {
      const style = document.createElement('style');
      style.textContent = CSS;
      shadow.appendChild(style);
    }

    ballEl = el('div', { class: 'aipf-ball' });
    ballEl.innerHTML = BALL_ICON;
    ballEl.addEventListener('pointerdown', onBallPointerDown);
    shadow.appendChild(ballEl);

    const wrap = document.createElement('div');
    wrap.innerHTML = PANEL_HTML;
    panelEl = wrap.firstElementChild;
    shadow.appendChild(panelEl);

    toastEl = el('div', { class: 'aipf-toast' });
    shadow.appendChild(toastEl);

    fileInputEl = el('input', { type: 'file', accept: '.json,application/json' });
    fileInputEl.style.display = 'none';
    fileInputEl.addEventListener('change', onImportFile);
    shadow.appendChild(fileInputEl);

    listEl = panelEl.querySelector('.aipf-list');
    emptyEl = panelEl.querySelector('.aipf-empty');
    countEl = panelEl.querySelector('.aipf-count');
    searchEl = panelEl.querySelector('.aipf-search-input');
    modeEl = panelEl.querySelector('.aipf-mode');
    editTitleEl = panelEl.querySelector('[data-field="title"]');
    editContentEl = panelEl.querySelector('[data-field="content"]');
    settingsViewEl = panelEl.querySelector('[data-view="settings"]');

    localize(panelEl);
    ballEl.title = t('ball.title');

    panelEl.addEventListener('click', onPanelClick);
    panelEl.addEventListener('input', (e) => {
      if (e.target === searchEl) renderList();
    });

    const root = document.body || document.documentElement;
    root.appendChild(host);

    applyTheme();
    applyPos();
    render();
  }

  function destroyUI() {
    if (!host) return;
    host.remove();
    host = null;
    shadow = null;
    ballEl = panelEl = toastEl = listEl = emptyEl = countEl = null;
    searchEl = modeEl = editTitleEl = editContentEl = fileInputEl = settingsViewEl = null;
  }

  // ------------------------------------------------------------ 位置 / 外观

  function applyPos() {
    if (!ballEl) return;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const pos = state.settings.pos;

    pos.right = clamp(Number(pos.right) || 22, 4, Math.max(4, vw - 52));
    pos.bottom = clamp(Number(pos.bottom) || 96, 4, Math.max(4, vh - 52));

    ballEl.style.right = pos.right + 'px';
    ballEl.style.bottom = pos.bottom + 'px';
    ballEl.style.left = 'auto';
    ballEl.style.top = 'auto';

    panelEl.style.right = clamp(pos.right, 8, Math.max(8, vw - 352)) + 'px';

    const spaceAbove = vh - (pos.bottom + 44);
    const panelHeight = Math.min(vh * 0.68, 620);
    if (spaceAbove >= Math.min(panelHeight, 320) + 12) {
      panelEl.style.bottom = pos.bottom + 54 + 'px';
      panelEl.style.top = 'auto';
    } else {
      panelEl.style.top = clamp(pos.bottom + 54, 8, Math.max(8, vh - 200)) + 'px';
      panelEl.style.bottom = 'auto';
    }

    if (toastEl) {
      toastEl.style.right = clamp(pos.right - 40, 8, Math.max(8, vw - 300)) + 'px';
      toastEl.style.bottom = pos.bottom + 58 + 'px';
      toastEl.style.top = 'auto';
    }
  }

  /** 主题 + 设置项控件的选中态 */
  function applyTheme() {
    if (host) host.setAttribute('data-theme', state.settings.theme || 'auto');
    if (!settingsViewEl) return;

    for (const btn of settingsViewEl.querySelectorAll('[data-act="set-theme"]')) {
      btn.setAttribute('data-on', btn.getAttribute('data-value') === state.settings.theme ? '1' : '0');
    }
    for (const btn of settingsViewEl.querySelectorAll('[data-act="set-lang"]')) {
      btn.setAttribute('data-on', btn.getAttribute('data-value') === state.settings.lang ? '1' : '0');
    }
    const autoHide = settingsViewEl.querySelector('[data-act="toggle-autohide"]');
    if (autoHide) autoHide.checked = !!state.settings.autoHide;
    for (const radio of settingsViewEl.querySelectorAll('[data-act="set-mode"]')) {
      radio.checked = radio.value === state.settings.mode;
    }
  }

  function resetPos() {
    state.settings.pos = Object.assign({}, DEFAULT_SETTINGS.pos);
    applyPos();
    saveSettings();
  }

  /** 语言变了：文案在 DOM 里，重建一次浮窗最稳妥 */
  function rebuildForLang() {
    destroyUI();
    buildUI();
    if (state.settings.open) openPanel(false);
    else closePanel(false);
    setView('settings');
    toast(t('toast.langChanged'));
  }

  // ------------------------------------------------------------ 渲染

  function render() {
    if (!panelEl) return;
    renderList();
    applyTheme();
    for (const v of panelEl.querySelectorAll('.aipf-view')) {
      v.hidden = v.getAttribute('data-view') !== view;
    }
  }

  function visiblePrompts() {
    const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();
    if (!q) return state.prompts;
    return state.prompts.filter((p) => (p.title + '\n' + p.content).toLowerCase().indexOf(q) >= 0);
  }

  function renderList() {
    if (!listEl) return;
    listEl.textContent = '';
    const items = visiblePrompts();

    countEl.textContent = state.prompts.length ? t('panel.count', { n: state.prompts.length }) : '';
    emptyEl.hidden = items.length > 0;
    if (!emptyEl.hidden) renderEmpty();

    for (const p of items) listEl.appendChild(buildItem(p));

    const isReplace = state.settings.mode === 'replace';
    modeEl.textContent = t(isReplace ? 'mode.replace' : 'mode.append');
    modeEl.title = t(isReplace ? 'mode.replaceTitle' : 'mode.appendTitle');
  }

  function renderEmpty() {
    emptyEl.textContent = '';
    if (state.prompts.length) {
      emptyEl.textContent = t('list.emptyFilter');
      return;
    }
    emptyEl.appendChild(el('div', null, t('list.emptyNone')));
    const actions = el('div', { class: 'aipf-empty-actions' });
    actions.appendChild(el('button', { class: 'aipf-btn', 'data-act': 'new' }, t('list.create')));
    actions.appendChild(el('button', { class: 'aipf-btn ghost', 'data-act': 'import' }, t('settings.import')));
    emptyEl.appendChild(actions);
  }

  function buildItem(p) {
    const row = el('div', { class: 'aipf-item', 'data-id': p.id, title: t('list.insertTitle') });
    const main = el('div', { class: 'aipf-item-main' });
    main.appendChild(el('div', { class: 'aipf-item-title' }, p.title));
    main.appendChild(el('div', { class: 'aipf-item-preview' }, preview(p.content)));

    const actions = el('div', { class: 'aipf-item-actions' });
    actions.appendChild(toolBtn('edit', p.id, '✎', t('item.edit')));
    actions.appendChild(toolBtn('copy', p.id, '⧉', t('item.copy')));
    actions.appendChild(toolBtn('del', p.id, '✕', t('item.del'), true));

    row.appendChild(main);
    row.appendChild(actions);
    return row;
  }

  function toolBtn(act, id, glyph, title, danger) {
    return el('button', {
      class: 'aipf-icon sm' + (danger ? ' danger' : ''),
      'data-act': act,
      'data-id': id,
      title: title,
    }, glyph);
  }

  // ------------------------------------------------------------ 交互

  function setView(next) {
    view = next;
    if (next !== 'edit') editingId = null;
    render();
    if (next === 'edit' && editTitleEl) editTitleEl.focus();
  }

  function openPanel(focusSearch) {
    if (!panelEl) return;
    state.settings.open = true;
    panelEl.hidden = false;
    ballEl.setAttribute('data-active', '1');
    applyPos();
    if (focusSearch && searchEl) searchEl.focus();
    saveSettings();
  }

  function closePanel(remember) {
    if (!panelEl) return;
    state.settings.open = false;
    panelEl.hidden = true;
    ballEl.setAttribute('data-active', '0');
    if (view !== 'list') setView('list');
    if (remember !== false) saveSettings();
  }

  function togglePanel() {
    if (state.settings.open) closePanel();
    else openPanel(false);
  }

  function toast(message, kind) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.setAttribute('data-kind', kind === 'error' ? 'error' : 'info');
    toastEl.setAttribute('data-show', '1');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.setAttribute('data-show', '0'), 2000);
  }

  function insertPrompt(p) {
    const res = NS.insert ? NS.insert(p.content, { mode: state.settings.mode }) : { ok: false };
    if (res.ok) {
      toast(t(state.settings.mode === 'replace' ? 'toast.insertReplace' : 'toast.insertAppend'));
      if (state.settings.autoHide) closePanel();
    } else {
      toast(t('toast.notFound'), 'error');
    }
  }

  function onPanelClick(e) {
    const target = e.target;
    const btn = target && target.closest ? target.closest('[data-act]') : null;
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      handleAction(btn.getAttribute('data-act'), btn.getAttribute('data-id'), btn);
      return;
    }
    const item = target && target.closest ? target.closest('.aipf-item') : null;
    if (item) {
      const p = findPrompt(item.getAttribute('data-id'));
      if (p) insertPrompt(p);
    }
  }

  function handleAction(act, id, btn) {
    switch (act) {
      case 'new':
        openEdit(null);
        break;
      case 'edit':
        openEdit(id);
        break;
      case 'del':
        deletePrompt(id);
        break;
      case 'copy':
        copyPrompt(id);
        break;
      case 'save-edit':
        saveEdit();
        break;
      case 'cancel-edit':
        setView('list');
        break;
      case 'settings':
        setView('settings');
        break;
      case 'back':
        setView('list');
        break;
      case 'close':
        closePanel();
        break;
      case 'toggle-mode':
        state.settings.mode = state.settings.mode === 'replace' ? 'append' : 'replace';
        saveSettings();
        render();
        toast(t(state.settings.mode === 'replace' ? 'toast.modeReplace' : 'toast.modeAppend'));
        break;
      case 'set-mode':
        state.settings.mode = btn.value === 'replace' ? 'replace' : 'append';
        saveSettings();
        render();
        break;
      case 'set-theme':
        state.settings.theme = btn.getAttribute('data-value') || 'auto';
        saveSettings();
        applyTheme();
        break;
      case 'set-lang':
        state.settings.lang = btn.getAttribute('data-value') || 'auto';
        saveSettings();
        applyLang();
        rebuildForLang();
        break;
      case 'toggle-autohide':
        state.settings.autoHide = !!btn.checked;
        saveSettings();
        break;
      case 'export':
        exportJSON();
        break;
      case 'import':
        if (fileInputEl) fileInputEl.click();
        break;
      case 'clear-all':
        clearAll();
        break;
      case 'reset-pos':
        resetPos();
        toast(t('toast.posReset'));
        break;
      default:
        break;
    }
  }

  function openEdit(id) {
    const p = id ? findPrompt(id) : null;
    editingId = p ? p.id : null;
    editTitleEl.value = p ? p.title : '';
    editContentEl.value = p ? p.content : '';
    const hint = panelEl.querySelector('[data-role="edit-hint"]');
    if (hint) hint.textContent = t(p ? 'edit.hintEdit' : 'edit.hintNew');
    setView('edit');
    editContentEl.focus();
  }

  function saveEdit() {
    const title = (editTitleEl.value || '').trim();
    const content = editContentEl.value || '';
    if (!content.trim()) {
      toast(t('error.emptyContent'), 'error');
      editContentEl.focus();
      return;
    }
    const finalTitle = title || content.trim().replace(/\s+/g, ' ').slice(0, 16);
    if (editingId) {
      const p = findPrompt(editingId);
      if (p) {
        p.title = finalTitle;
        p.content = content;
      }
    } else {
      state.prompts.unshift({ id: uid(), title: finalTitle, content: content });
    }
    savePrompts();
    setView('list');
    render();
    toast(t('toast.saved'));
  }

  function deletePrompt(id) {
    const p = findPrompt(id);
    if (!p) return;
    state.prompts = state.prompts.filter((x) => x.id !== id);
    savePrompts();
    render();
    toast(t('toast.deleted', { title: p.title }));
  }

  function clearAll() {
    if (!state.prompts.length) return;
    if (!window.confirm(t('confirm.clear', { n: state.prompts.length }))) return;
    state.prompts = [];
    savePrompts();
    render();
    toast(t('toast.cleared'));
  }

  async function copyPrompt(id) {
    const p = findPrompt(id);
    if (!p) return;
    const ok = await copyText(p.content);
    toast(t(ok ? 'toast.copied' : 'toast.copyFailed'), ok ? 'info' : 'error');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      /* 页面没有焦点时 clipboard API 会失败，走兜底 */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      shadow.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function exportJSON() {
    try {
      const payload = {
        app: 'ai-prompt-float',
        version: 1,
        exportedAt: new Date().toISOString(),
        prompts: state.prompts,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-prompt-float-' + new Date().toISOString().slice(0, 10) + '.json';
      shadow.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(t('toast.exported', { n: state.prompts.length }));
    } catch (e) {
      toast(t('toast.exportFailed'), 'error');
    }
  }

  async function onImportFile() {
    const file = fileInputEl.files && fileInputEl.files[0];
    fileInputEl.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = normalizePrompts(Array.isArray(data) ? data : data && data.prompts);
      if (!list.length) {
        toast(t('toast.importEmpty'), 'error');
        return;
      }
      const ok = window.confirm(t('confirm.import', { n: list.length, m: state.prompts.length }));
      if (!ok) return;
      state.prompts = list;
      savePrompts();
      render();
      toast(t('toast.imported', { n: list.length }));
    } catch (e) {
      toast(t('toast.importFailed'), 'error');
    }
  }

  // ------------------------------------------------------------ 拖动

  function onBallPointerDown(e) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { right: state.settings.pos.right, bottom: state.settings.pos.bottom };
    let moved = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      state.settings.pos.right = startPos.right - dx;
      state.settings.pos.bottom = startPos.bottom - dy;
      applyPos();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      if (moved) saveSettings();
      else togglePanel();
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    e.preventDefault();
    e.stopPropagation();
  }

  // ------------------------------------------------------------ 全局事件

  // 按键护盾
  // ChatGPT / Grok 这类站点会监听全局按键，实现「在页面任意处打字即自动聚焦聊天输入框」。
  // 浮窗在 Shadow DOM 里：站点在 document 上看到的 target 会被重定向成宿主节点，
  // document.activeElement 也不是它的输入框，于是它判定「用户想在页面里打字」，
  // 把焦点抢进聊天框，你输入的字就跑到了网页输入框里。
  // 解决：在 window 的捕获阶段（比站点在 document/window 冒泡阶段更早）截住来自浮窗的事件，
  // 只截断传播、不 preventDefault，所以浏览器照常把字打进浮窗，站点却完全看不到。
  const SHIELD_EVENTS = [
    'keydown',
    'keypress',
    'keyup',
    'beforeinput',
    'input',
    'compositionstart',
    'compositionupdate',
    'compositionend',
  ];

  let keyShieldOn = true;

  function isEventFromPanel(e) {
    if (!host) return false;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    if (path && path.length) return path.indexOf(host) >= 0;
    return !!(e.target && e.target.getRootNode && e.target.getRootNode() === shadow);
  }

  /** 浮窗内部的快捷键：事件被护盾截断，不会再传给下面的公共处理器，所以在这里处理 */
  function handlePanelKey(e) {
    if (e.key === 'Escape' && state.settings.open) {
      e.preventDefault();
      if (view === 'list') closePanel();
      else setView('list');
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      togglePanel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target === editTitleEl) {
      e.preventDefault();
      saveEdit();
    }
  }

  function onShieldedEvent(e) {
    if (!keyShieldOn || !isEventFromPanel(e)) return;
    if (e.type === 'keydown') handlePanelKey(e);
    // 必须用 stopImmediatePropagation：站点的同类监听常常也注册在 window 捕获阶段，
    // 而 stopPropagation 挡不住「同一个节点上」的其它监听器，只有它能一起挡掉。
    e.stopImmediatePropagation();
  }

  function bindKeyShield() {
    for (const type of SHIELD_EVENTS) window.addEventListener(type, onShieldedEvent, true);
  }

  function onKeyDown(e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
      return;
    }
    if (e.key === 'Escape' && state.settings.open) {
      if (view === 'list') closePanel();
      else setView('list');
    }
  }

  function onStorageChanged(changes, area) {
    if (area && area !== 'local') return;
    if (changes[KEY_PROMPTS]) {
      state.prompts = normalizePrompts(changes[KEY_PROMPTS].newValue);
      render();
    }
    if (changes[KEY_SETTINGS]) {
      state.settings = Object.assign({}, DEFAULT_SETTINGS, changes[KEY_SETTINGS].newValue || {});
      applyEnabled();
      if (host) {
        applyLang();
        localize(panelEl);
        ballEl.title = t('ball.title');
        applyTheme();
        applyPos();
        render();
        panelEl.hidden = !state.settings.open;
        ballEl.setAttribute('data-active', state.settings.open ? '1' : '0');
      }
    }
  }

  function applyEnabled() {
    if (state.settings.enabled) {
      buildUI();
      if (state.settings.open) openPanel(false);
      else closePanel(false);
    } else {
      destroyUI();
    }
  }

  async function handleMessage(msg) {
    // 页面刚注入时初始化可能还没跑完，等它结束再应答
    await ready;
    switch (msg.type) {
      case 'aipf:toggle':
        if (!state.settings.enabled) {
          state.settings.enabled = true;
          saveSettings();
        }
        buildUI();
        togglePanel();
        return { ok: true, open: state.settings.open };
      case 'aipf:open':
        state.settings.enabled = true;
        saveSettings();
        buildUI();
        openPanel(true);
        return { ok: true, open: true };
      case 'aipf:insert': {
        const p = findPrompt(msg.id);
        if (p) insertPrompt(p);
        return { ok: !!p };
      }
      case 'aipf:ping':
        return {
          ok: true,
          prompts: state.prompts.length,
          enabled: state.settings.enabled,
          lang: lang,
          injected: true,
        };
      default:
        return { ok: false, reason: 'unknown-message' };
    }
  }

  function bindRuntime() {
    const runtime = globalThis.chrome && chrome.runtime;
    if (!runtime) return;
    try {
      if (runtime.onMessage) {
        runtime.onMessage.addListener((msg, sender, sendResponse) => {
          if (!msg || typeof msg.type !== 'string') return undefined;
          handleMessage(msg).then(
            (resp) => sendResponse(resp || { ok: false }),
            () => sendResponse({ ok: false, reason: 'handler-error' })
          );
          return true; // 异步应答，保持消息通道打开
        });
      }
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(onStorageChanged);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // ------------------------------------------------------------ 启动

  async function init() {
    const res = await storeGet([KEY_PROMPTS, KEY_SETTINGS]);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, res[KEY_SETTINGS] || {});
    applyLang();
    // 不预置提示词：没存过就是空列表
    state.prompts = normalizePrompts(res[KEY_PROMPTS]);

    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', () => host && applyPos());

    if (state.settings.enabled) {
      buildUI();
      if (state.settings.open) openPanel(false);
      else closePanel(false);
    }

    if (readyResolve) readyResolve();
    NS.__ui.ready = true;
  }

  // 供测试页 / 调试使用
  NS.__ui = {
    state,
    init,
    buildUI,
    destroyUI,
    render,
    open: () => openPanel(false),
    close: () => closePanel(),
    setView,
    normalizePrompts,
    DEFAULT_SETTINGS,
    ready: false,
    currentLang: () => lang,
    // 测试用：临时关闭按键护盾，用来复现「按键被网页抢走」
    setKeyShield: (on) => {
      keyShieldOn = !!on;
    },
  };

  // 消息监听与按键护盾立刻注册：这样 popup 在页面刚注入时发消息也不会丢，
  // 护盾也能赶在站点脚本之前注册（配合 manifest 的 document_start）。
  bindRuntime();
  bindKeyShield();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
