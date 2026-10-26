/* 通过 CDP 向页面发送「真实键盘事件」，验证浮窗内输入不会被站点全局按键监听抢走。
 *
 * 真实按键（Input.dispatchKeyEvent）会触发浏览器的默认输入行为，而 page.evaluate 里的
 * 合成 KeyboardEvent 不会——所以这个测试能同时验证两件事：
 *   1. 护盾开启后，按键不再泄漏给站点监听器（字不会被抢进网页输入框）
 *   2. 护盾只 stopPropagation、不 preventDefault，字仍然能正常打进浮窗输入框
 *
 * 用法：node test/cdp-typing.mjs <调试端口> [页面文件名片段]
 */
const port = Number(process.argv[2] || 9333);
const targetMatch = process.argv[3] || 'hostile.html';

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok, extra: extra == null ? '' : String(extra) });
}
function report() {
  const pass = results.filter((r) => r.ok).length;
  const lines = results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ' | ' + r.name + (r.extra ? '  → ' + r.extra : ''));
  console.log('AIPF-TYPE ' + pass + '/' + results.length);
  console.log(lines.join('\n'));
  process.exit(pass === results.length ? 0 : 1);
}

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(targetMatch));
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (e) {
      /* Chrome 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const target = await findTarget();
if (!target) {
  check('连接到测试页面', false, '没找到 ' + targetMatch + ' 的调试目标');
  report();
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error('WebSocket 连接失败'));
});

let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)));
  }
  return r.result.value;
}

/** 逐字发送真实按键 */
async function typeText(text) {
  for (const ch of text) {
    const upper = ch.toUpperCase();
    const code = /[a-z]/i.test(ch) ? 'Key' + upper : '';
    const vk = upper.charCodeAt(0);
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown', text: ch, unmodifiedText: ch, key: ch, code,
      windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: ch, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    });
  }
}

async function pressEscape() {
  const base = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
  await send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.bringToFront');
  // 无头窗口本身没获得系统焦点时，浏览器不会把按键派发给页面里聚焦的元素，
  // 打开焦点模拟后，DOM 焦点才会真正决定按键目标。
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });

  const ready = await evaluate(`(async () => {
    for (let i = 0; i < 160; i++) {
      if (window.AIPF && window.AIPF.__ui && window.AIPF.__ui.ready === true) return 'ready';
      await new Promise((r) => setTimeout(r, 50));
    }
    return 'timeout';
  })()`);
  if (ready !== 'ready') {
    check('扩展脚本在页面中就绪', false, String(ready));
    report();
  }
  check('扩展脚本在页面中就绪', true);

  // ---- 场景 1：护盾开启，浮窗里打字不应被网页抢走 ----
  const prepared = await evaluate('window.__t.prepare()');
  check('编辑器获得焦点', prepared && prepared.focusedField === 'content', JSON.stringify(prepared));

  await typeText('hello');
  const afterShielded = await evaluate('window.__t.read()');
  const probe = await evaluate('JSON.stringify(window.__probe.slice(0, 3))');
  check(
    '护盾开启：字符完整进入浮窗输入框',
    afterShielded.panel === 'hello',
    'panel=' + JSON.stringify(afterShielded.panel) + ' probe=' + probe
  );
  check(
    '护盾开启：网页输入框没有抢到任何字符',
    afterShielded.composer === '' && afterShielded.stolen === '',
    'composer=' + JSON.stringify(afterShielded.composer) + ' stolen=' + JSON.stringify(afterShielded.stolen)
  );
  check('护盾开启：焦点仍留在浮窗内', afterShielded.focusedField === 'content', 'focused=' + afterShielded.focusedField);

  // ---- 场景 2：关掉护盾，应当复现你遇到的现象（证明这个测试是有效的） ----
  await evaluate('window.__t.shield(false)');
  await evaluate('window.__t.prepare()');
  await typeText('xy');
  const afterUnshielded = await evaluate('window.__t.read()');
  const leaked = afterUnshielded.composer || '';
  check(
    '关掉护盾后能复现该问题（测试有效性）',
    leaked.indexOf('x') >= 0 && leaked.indexOf('y') >= 0 && afterUnshielded.panel === '',
    'composer=' + JSON.stringify(leaked) + ' panel=' + JSON.stringify(afterUnshielded.panel)
  );
  await evaluate('window.__t.shield(true)');

  // ---- 场景 3：护盾不应吃掉浮窗自己的快捷键 ----
  await evaluate('window.__t.prepare()');
  await pressEscape();
  const view = await evaluate('window.__t.view()');
  check(
    '护盾开启：Esc 仍能从编辑页返回列表',
    view && view.panelOpen === true && view.editVisible === false,
    JSON.stringify(view)
  );
} catch (err) {
  check('测试过程中未抛异常', false, String(err && err.message ? err.message : err));
}

report();
