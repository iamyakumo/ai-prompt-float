/* AI 提示词浮窗 —— 文案表（中 / 英）
 *
 * 不用 chrome.i18n 的原因：设置里允许手动覆盖语言，而 chrome.i18n.getMessage 只会按
 * 浏览器语言返回，覆盖不了。所以界面文案走这份表，_locales 只负责扩展名/描述这类
 * 由 Chrome 自己展示的字符串（那里的语言必须跟随浏览器）。
 *
 * 全局变量：AIPF_I18N = { detect, resolve, make, CATALOGS }
 */
(function () {
  'use strict';

  const zh = {
    // 扩展与浮窗
    extName: 'AI 提示词浮窗',
    extDesc: '在 ChatGPT / Gemini / Grok / Kimi 网页版上加一个自定义浮窗，点击即把预设提示词填入输入框（不自动发送）。',
    actionTitle: 'AI 提示词浮窗',
    'panel.title': '提示词',
    'panel.add': '新增提示词',
    'panel.settings': '设置',
    'panel.close': '收起浮窗（Esc）',
    'panel.search': '搜索提示词…',
    'panel.count': '· {n} 条',
    'ball.title': 'AI 提示词浮窗（可拖动 / Alt+P）',

    // 插入方式
    'mode.append': '追加',
    'mode.replace': '覆盖',
    'mode.appendTitle': '当前：追加到末尾（点击切换为覆盖）',
    'mode.replaceTitle': '当前：覆盖输入框（点击切换为追加）',

    // 列表
    'list.emptyNone': '还没有提示词',
    'list.emptyFilter': '没有匹配的提示词',
    'list.create': '新建提示词',
    'list.insertTitle': '点击填入输入框',
    'item.edit': '编辑',
    'item.copy': '复制内容',
    'item.del': '删除',
    'foot.hint': '点击提示词 = 填入输入框，不自动发送',

    // 编辑
    'edit.titleLabel': '标题',
    'edit.titlePh': '例如：代码审查',
    'edit.contentLabel': '内容（会原样填入网页输入框）',
    'edit.contentPh': '例如：请审查下面的代码，指出潜在 bug、性能问题和可读性问题：',
    'edit.cancel': '取消',
    'edit.save': '保存',
    'edit.hintNew': '新建提示词',
    'edit.hintEdit': '正在编辑已有提示词',

    // 设置
    'settings.mode': '插入方式',
    'settings.append': '追加到末尾',
    'settings.appendDesc': '保留已输入的内容，提示词接在后面',
    'settings.replace': '覆盖输入框',
    'settings.replaceDesc': '清空当前内容后填入',
    'settings.autoHide': '填入后自动收起浮窗',
    'settings.autoHideDesc': '填完立刻继续打字',
    'settings.language': '界面语言',
    'settings.langAuto': '跟随浏览器',
    'settings.langZh': '中文',
    'settings.langEn': 'English',
    'settings.theme': '主题',
    'settings.themeAuto': '跟随系统',
    'settings.themeLight': '浅色',
    'settings.themeDark': '深色',
    'settings.data': '提示词数据',
    'settings.export': '导出 JSON',
    'settings.import': '导入 JSON',
    'settings.clear': '清空全部',
    'settings.dataHint': '导出后可在编辑器里批量改写，再导入覆盖。本扩展不预置任何提示词，列表由你自己维护。',
    'settings.other': '其它',
    'settings.resetPos': '重置浮窗位置',
    'settings.back': '返回列表',
    'settings.otherHint': '拖动圆形按钮可换位置；快捷键 Alt + P 收起 / 展开。',

    // 提示
    'toast.insertAppend': '已追加到输入框',
    'toast.insertReplace': '已覆盖填入输入框',
    'toast.notFound': '没找到聊天输入框，先点一下网页输入框再试',
    'toast.saved': '已保存',
    'toast.deleted': '已删除「{title}」',
    'toast.copied': '已复制内容',
    'toast.copyFailed': '复制失败，请手动选中复制',
    'toast.exported': '已导出 {n} 条提示词',
    'toast.exportFailed': '导出失败',
    'toast.imported': '已导入 {n} 条',
    'toast.importEmpty': '文件里没有可用的提示词',
    'toast.importFailed': '导入失败：不是有效的 JSON',
    'toast.cleared': '已清空提示词',
    'toast.langChanged': '界面语言已切换',
    'toast.posReset': '浮窗位置已重置',
    'toast.modeAppend': '插入方式：追加',
    'toast.modeReplace': '插入方式：覆盖',
    'error.emptyContent': '内容不能为空',
    'confirm.import': '导入 {n} 条提示词，会替换当前的 {m} 条。\n建议先「导出 JSON」备份，确定继续？',
    'confirm.clear': '清空全部 {n} 条提示词？此操作不可撤销，建议先「导出 JSON」备份。',
    'common.untitled': '未命名',

    // 弹窗
    'popup.count': '已保存 {n} 条提示词',
    'popup.countEmpty': '还没有提示词：打开浮窗后新建，或在浮窗设置里导入 JSON',
    'popup.enable': '在支持的网站上显示浮窗',
    'popup.enableHint': '关掉后浮窗从所有标签页移除，提示词数据保留。',
    'popup.behavior': '点击提示词时',
    'popup.append': '追加到输入框末尾',
    'popup.appendDesc': '保留已输入的内容',
    'popup.replace': '覆盖输入框',
    'popup.replaceDesc': '清空后填入',
    'popup.autoHide': '填入后自动收起浮窗',
    'popup.openHere': '在当前标签页打开浮窗',
    'popup.opening': '正在打开…',
    'popup.shortcutHint': '页面内快捷键 Alt + P 可随时收起 / 展开浮窗；圆形按钮可拖动换位置。',
    'popup.fail': '这个页面打不开浮窗：可能是浏览器内部页面（chrome://、扩展商店等），或是本扩展无权访问的站点。请切到 ChatGPT / Gemini / Grok / Kimi 的页面对应标签页再点一次。',
  };

  const en = {
    extName: 'AI Prompt Dock',
    extDesc: 'Adds a floating panel to ChatGPT, Gemini, Grok and Kimi web apps: click a saved prompt to drop it into the input box (nothing is sent automatically).',
    actionTitle: 'AI Prompt Dock',
    'panel.title': 'Prompts',
    'panel.add': 'New prompt',
    'panel.settings': 'Settings',
    'panel.close': 'Collapse (Esc)',
    'panel.search': 'Search prompts…',
    'panel.count': '· {n}',
    'ball.title': 'AI Prompt Dock (draggable / Alt+P)',

    'mode.append': 'Append',
    'mode.replace': 'Replace',
    'mode.appendTitle': 'Now: append to the end (click to switch to replace)',
    'mode.replaceTitle': 'Now: replace the input box (click to switch to append)',

    'list.emptyNone': 'No prompts yet',
    'list.emptyFilter': 'No matching prompts',
    'list.create': 'New prompt',
    'list.insertTitle': 'Click to insert',
    'item.edit': 'Edit',
    'item.copy': 'Copy text',
    'item.del': 'Delete',
    'foot.hint': 'Click a prompt to insert it — nothing is sent automatically',

    'edit.titleLabel': 'Title',
    'edit.titlePh': 'e.g. Code review',
    'edit.contentLabel': 'Content (inserted into the page input box as-is)',
    'edit.contentPh': 'e.g. Review the code below for bugs, performance and readability problems:',
    'edit.cancel': 'Cancel',
    'edit.save': 'Save',
    'edit.hintNew': 'New prompt',
    'edit.hintEdit': 'Editing an existing prompt',

    'settings.mode': 'Insert mode',
    'settings.append': 'Append to the end',
    'settings.appendDesc': 'Keep what you already typed and add the prompt after it',
    'settings.replace': 'Replace the input box',
    'settings.replaceDesc': 'Clear the current content first',
    'settings.autoHide': 'Collapse the panel after inserting',
    'settings.autoHideDesc': 'Get straight back to typing',
    'settings.language': 'Language',
    'settings.langAuto': 'Browser default',
    'settings.langZh': '中文',
    'settings.langEn': 'English',
    'settings.theme': 'Theme',
    'settings.themeAuto': 'System',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.data': 'Prompt data',
    'settings.export': 'Export JSON',
    'settings.import': 'Import JSON',
    'settings.clear': 'Clear all',
    'settings.dataHint': 'Export, edit the JSON in bulk, then import it back. This extension ships with no preset prompts — the list is yours to maintain.',
    'settings.other': 'Other',
    'settings.resetPos': 'Reset panel position',
    'settings.back': 'Back to list',
    'settings.otherHint': 'Drag the round button to move the panel; press Alt + P to collapse / expand.',

    'toast.insertAppend': 'Appended to the input box',
    'toast.insertReplace': 'Replaced the input box content',
    'toast.notFound': "Couldn't find the chat input — click the page's input box once, then retry",
    'toast.saved': 'Saved',
    'toast.deleted': 'Deleted "{title}"',
    'toast.copied': 'Copied',
    'toast.copyFailed': 'Copy failed — please select and copy manually',
    'toast.exported': 'Exported {n} prompts',
    'toast.exportFailed': 'Export failed',
    'toast.imported': 'Imported {n}',
    'toast.importEmpty': 'No usable prompts in that file',
    'toast.importFailed': 'Import failed: not valid JSON',
    'toast.cleared': 'All prompts cleared',
    'toast.langChanged': 'Language switched',
    'toast.posReset': 'Panel position reset',
    'toast.modeAppend': 'Insert mode: append',
    'toast.modeReplace': 'Insert mode: replace',
    'error.emptyContent': "Content can't be empty",
    'confirm.import': 'Import {n} prompts and replace the current {m}?\nExport a backup first if you are not sure.',
    'confirm.clear': 'Delete all {n} prompts? This cannot be undone — export a backup first.',
    'common.untitled': 'Untitled',

    'popup.count': '{n} prompts saved',
    'popup.countEmpty': 'No prompts yet — open the panel to create one, or import JSON in its settings',
    'popup.enable': 'Show the panel on supported sites',
    'popup.enableHint': 'Turning this off removes the panel from all tabs; your prompts are kept.',
    'popup.behavior': 'When clicking a prompt',
    'popup.append': 'Append to the input box',
    'popup.appendDesc': 'Keep what is already there',
    'popup.replace': 'Replace the input box',
    'popup.replaceDesc': 'Clear it first',
    'popup.autoHide': 'Collapse the panel after inserting',
    'popup.openHere': 'Open the panel in this tab',
    'popup.opening': 'Opening…',
    'popup.shortcutHint': 'Press Alt + P in the page to collapse / expand the panel; drag the round button to move it.',
    'popup.fail': 'The panel cannot open on this page: it may be a browser-internal page (chrome://, the extension store) or a site this extension has no access to. Switch to a ChatGPT / Gemini / Grok / Kimi tab and try again.',
  };

  const CATALOGS = { zh: zh, en: en };

  /** 浏览器界面语言（zh* -> zh，其余 -> en） */
  function detect() {
    let raw = '';
    try {
      if (globalThis.chrome && chrome.i18n && chrome.i18n.getUILanguage) raw = chrome.i18n.getUILanguage();
    } catch (e) {
      /* 测试页里没有 chrome.i18n */
    }
    if (!raw && typeof navigator !== 'undefined') raw = navigator.language || '';
    return /^zh/i.test(raw) ? 'zh' : 'en';
  }

  /** 设置项 -> 实际使用的语言 */
  function resolve(setting) {
    if (setting === 'zh' || setting === 'en') return setting;
    return detect();
  }

  /** 生成某个语言的取词函数 */
  function make(lang) {
    const dict = CATALOGS[lang] || CATALOGS.en;
    const fallback = CATALOGS.en;
    return function t(key, vars) {
      let s = dict[key] != null ? dict[key] : fallback[key];
      if (s == null) return key;
      if (vars) {
        for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
      }
      return s;
    };
  }

  globalThis.AIPF_I18N = { detect: detect, resolve: resolve, make: make, CATALOGS: CATALOGS };
})();
