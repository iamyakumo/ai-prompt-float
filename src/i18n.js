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
    'settings.notion': 'Notion',
    'settings.notionToken': 'Integration Token',
    'settings.notionTokenPh': 'secret_… 或 ntn_…',
    'settings.notionDb': '数据库 ID 或链接',
    'settings.notionDbPh': 'https://www.notion.so/… 或 32 位 ID',
    'settings.notionPush': '推送到 Notion',
    'settings.notionPull': '从 Notion 拉取',
    'settings.notionBoth': '双向同步',
    'settings.notionOpen': '打开 Notion 集成页',
    'settings.notionHint': '令牌只保存在本机。数据库需要 Title（标题）、Content（文本）、PromptId（文本），并分享给该集成。双向同步时，Notion 里多出的条目会补进本地；同一 PromptId 以本地为准写回。',
    'settings.notionNever': '尚未同步',
    'settings.notionWorking': '正在与 Notion 同步…',
    'settings.notionStatusOk': '{time} · {action}成功 · 新建 {created}，更新 {updated}，补入 {pulled}',
    'settings.notionStatusFail': '{time} · {error}',
    'settings.notionActionPush': '推送',
    'settings.notionActionPull': '拉取',
    'settings.notionActionBoth': '双向',

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
    'toast.notionNeedToken': '请先填写 Integration Token',
    'toast.notionNeedDb': '请先填写数据库 ID 或链接',
    'toast.notionBadDb': '无法从输入里解析出数据库 ID',
    'toast.notionPushOk': '已推送到 Notion：新建 {created}，更新 {updated}',
    'toast.notionPullOk': '已从 Notion 拉取：新增 {pulled}，更新 {updated}',
    'toast.notionBothOk': '双向同步完成：补入 {pulled}，新建 {created}，更新 {updated}',
    'toast.notionFail': 'Notion 同步失败：{error}',
    'confirm.notionPull': '从 Notion 拉取会用数据库里的标题和正文覆盖本地相同 PromptId 的提示词（当前 {n} 条）。确定继续？',
    'notion.missingProps': '数据库缺少属性：{names}。请创建 Title（标题）、Content（文本）、PromptId（文本），名称需完全一致。',
    'notion.wrongType': '这些属性的类型不对：{names}。Title 必须是标题（title），Content 和 PromptId 必须是文本（rich_text）。',
    'notion.unauthorized': 'Token 无效，请检查集成密钥。',
    'notion.forbidden': '集成没有访问该数据库的权限。',
    'notion.notFound': '找不到该数据库。请确认 ID，并在 Notion 里把数据库连接（Connections）到这个集成。',
    'notion.notDatabase': '这个 ID 不是数据库。请打开数据库页面，复制地址栏里的链接。',
    'notion.network': '网络错误，请稍后重试。',
    'notion.rateLimit': 'Notion 请求过于频繁，请稍后再试。',
    'notion.noBackground': '后台服务未就绪，请在扩展管理页重新加载本扩展。',
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
    'popup.notionNote': 'Notion 同步在网页浮窗的 ⚙ 设置里。令牌只保存在本机。',
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
    'settings.notion': 'Notion',
    'settings.notionToken': 'Integration token',
    'settings.notionTokenPh': 'secret_… or ntn_…',
    'settings.notionDb': 'Database ID or URL',
    'settings.notionDbPh': 'https://www.notion.so/… or a 32-character ID',
    'settings.notionPush': 'Push to Notion',
    'settings.notionPull': 'Pull from Notion',
    'settings.notionBoth': 'Two-way sync',
    'settings.notionOpen': 'Open Notion integrations',
    'settings.notionHint': 'The token stays on this device. The database needs Title (title), Content (text) and PromptId (text), and must be shared with the integration. Two-way sync adds Notion-only rows locally, then writes local text back for the same PromptId.',
    'settings.notionNever': 'Not synced yet',
    'settings.notionWorking': 'Syncing with Notion…',
    'settings.notionStatusOk': '{time} · {action} ok · created {created}, updated {updated}, added {pulled}',
    'settings.notionStatusFail': '{time} · {error}',
    'settings.notionActionPush': 'Push',
    'settings.notionActionPull': 'Pull',
    'settings.notionActionBoth': 'Two-way',

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
    'toast.notionNeedToken': 'Enter an integration token first',
    'toast.notionNeedDb': 'Enter a database ID or URL first',
    'toast.notionBadDb': 'Could not find a database ID in that value',
    'toast.notionPushOk': 'Pushed to Notion: created {created}, updated {updated}',
    'toast.notionPullOk': 'Pulled from Notion: added {pulled}, updated {updated}',
    'toast.notionBothOk': 'Two-way sync done: added {pulled}, created {created}, updated {updated}',
    'toast.notionFail': 'Notion sync failed: {error}',
    'confirm.notionPull': 'Pulling from Notion overwrites local title and content for the same PromptId ({n} prompts now). Continue?',
    'notion.missingProps': 'The database is missing: {names}. Create Title (title), Content (text) and PromptId (text) with those exact names.',
    'notion.wrongType': 'Wrong property types: {names}. Title must be a title, and Content and PromptId must be text (rich_text).',
    'notion.unauthorized': 'The token was rejected. Check the integration secret.',
    'notion.forbidden': 'This integration cannot access that database.',
    'notion.notFound': 'Database not found. Check the ID and share the database with this integration (Connections).',
    'notion.notDatabase': 'That ID is not a database. Open the database and copy the URL from the address bar.',
    'notion.network': 'Network error. Try again in a moment.',
    'notion.rateLimit': 'Notion is rate-limiting requests. Wait a moment and try again.',
    'notion.noBackground': 'The background worker is not ready. Reload the extension on the extensions page.',
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
    'popup.notionNote': 'Set up Notion sync in the on-page panel settings (⚙). The token stays on this device.',
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
