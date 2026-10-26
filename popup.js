/* 扩展弹窗：全局开关、默认行为设置，以及「在当前标签页打开浮窗」 */
const KEY_PROMPTS = 'aipf.prompts';
const KEY_SETTINGS = 'aipf.settings';
const DEFAULTS = {
  enabled: true,
  mode: 'append',
  theme: 'auto',
  lang: 'auto',
  autoHide: true,
  pos: { right: 22, bottom: 96 },
  open: false,
};

const CONTENT_FILES = [
  'src/i18n.js',
  'src/panel-style.js',
  'src/insert.js',
  'src/content.js',
];

const I18N = globalThis.AIPF_I18N;
let t = (key) => key;

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function localize(root, tt) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = tt(node.getAttribute('data-i18n'));
  }
}

function load() {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEY_PROMPTS, KEY_SETTINGS], (res) => {
      resolve({
        prompts: Array.isArray(res[KEY_PROMPTS]) ? res[KEY_PROMPTS] : [],
        settings: Object.assign({}, DEFAULTS, res[KEY_SETTINGS] || {}),
      });
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => chrome.storage.local.set({ [KEY_SETTINGS]: settings }, resolve));
}

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0]));
  });
}

function tell(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        void chrome.runtime.lastError; // 没有接收方时会报错，这里当作「未注入」
        resolve(resp || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/** 旧标签页是在扩展安装/重载之前打开的，内容脚本不会补注入，这里手动注入一次 */
async function injectContentScripts(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    return true;
  } catch (e) {
    return false;
  }
}

async function openPanelIn(tab) {
  let resp = await tell(tab.id, { type: 'aipf:open' });
  if (resp && resp.ok) return resp;

  const injected = await injectContentScripts(tab.id);
  if (!injected) return null;

  // 注入后初始化是异步的，轮询几次等它就绪
  for (let i = 0; i < 10; i++) {
    await sleep(120);
    resp = await tell(tab.id, { type: 'aipf:open' });
    if (resp && resp.ok) return resp;
  }
  return null;
}

(async function main() {
  const { prompts, settings } = await load();

  t = I18N.make(I18N.resolve(settings.lang));
  localize(document, t);
  document.title = t('extName');

  $('count').textContent = prompts.length
    ? t('popup.count', { n: prompts.length })
    : t('popup.countEmpty');
  $('enabled').checked = !!settings.enabled;
  $('autoHide').checked = !!settings.autoHide;
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === settings.mode;
  }

  const patch = async (changes) => {
    Object.assign(settings, changes);
    await saveSettings(settings);
  };

  $('enabled').addEventListener('change', (e) => patch({ enabled: e.target.checked }));
  $('autoHide').addEventListener('change', (e) => patch({ autoHide: e.target.checked }));
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) patch({ mode: e.target.value });
    });
  }

  $('open').addEventListener('click', async () => {
    const status = $('status');
    const btn = $('open');
    btn.disabled = true;
    btn.textContent = t('popup.opening');
    status.textContent = '';

    const tab = await activeTab();
    let resp = null;
    if (tab && tab.id != null) resp = await openPanelIn(tab);

    if (resp && resp.ok) {
      window.close();
      return;
    }

    btn.disabled = false;
    btn.textContent = t('popup.openHere');
    status.textContent = t('popup.fail');
  });
})();
