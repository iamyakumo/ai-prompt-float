# AI 提示词浮窗 / AI Prompt Dock

在 **ChatGPT / Gemini / Grok / Kimi** 网页版上加一个可拖动的浮窗，里面放你自己的提示词。
**点击提示词 → 原样填入聊天输入框，不自动发送**，你可以在发出前再补充内容。

- 纯前端扩展，Manifest V3，无后台服务、不联网、不上传任何数据
- **不预置任何提示词**：首次安装列表为空，由你自己新建或导入 JSON
- **界面中英双语**：默认跟随浏览器界面语言，也可在浮窗设置里手动切换（中文 / English）
- 提示词存在浏览器本地（`chrome.storage.local`），支持编辑、搜索、导入导出
- 针对四个站点的编辑器形态分别适配：原生 `textarea`、React 受控 `textarea`、`contenteditable`（ProseMirror / Quill / 自研）

---

## 一、安装（加载已解压的扩展程序）

1. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）
2. 打开右上角「**开发者模式**」
3. 点「**加载已解压的扩展程序**」，选择本目录 **`ai-prompt-float`**（包含 `manifest.json` 的那一层）
4. 装好后**刷新**已经打开的 ChatGPT / Gemini / Grok / Kimi 标签页

> 旧标签页是在扩展安装之前打开的，内容脚本不会自动补注入（这是浏览器的通用行为）。
> 除了按 F5，你也可以点工具栏图标 →「在当前标签页打开浮窗 / Open the panel in this tab」，扩展会就地注入一次。

> Chrome 137+ 已经移除了命令行 `--load-extension`，所以只能用上面的手动方式加载，这是正常现象。
> 扩展只用 `storage`（保存提示词）和 `scripting`（在旧标签页就地注入浮窗）两项权限，都不会产生安装警告，也不会读取你的聊天内容。

---

## 二、首次使用

装好后浮窗里是**空的**（本扩展不预置提示词），空状态会给出两个入口：

- **新建提示词**：填标题 + 内容，保存后点击列表项即可填入网页输入框
- **导入 JSON**：批量导入，格式见「数据与备份」

也可以先在浮窗里点 `＋` 建几条，再慢慢积累。

---

## 三、使用

| 操作 | 说明 |
| --- | --- |
| 点圆形按钮 | 展开 / 收起提示词面板 |
| 拖动圆形按钮 | 换位置，自动记住 |
| `Alt` + `P` | 随时展开 / 收起（网页内快捷键） |
| 点提示词 | 按当前模式填入聊天输入框，顶部弹出提示 |
| 悬停提示词右侧图标 | `✎` 编辑、`⧉` 复制到剪贴板、`✕` 删除 |
| 搜索框 | 按标题或内容实时过滤 |
| 「追加 / 覆盖」胶囊 | 点一下切换本次的插入方式 |
| `＋` | 新增提示词（标题 + 内容） |
| `⚙` | 设置：插入方式、自动收起、界面语言、主题、导入导出、清空、重置位置 |
| `Esc` | 编辑页返回列表；列表页收起面板 |

---

## 四、设置项

- **插入方式**
  - `追加到末尾`（默认）：保留你已经输入的内容，提示词接在后面；如果输入框里有选中的文字，则替换选中的部分
  - `覆盖输入框`：清空当前内容后填入
- **填入后自动收起浮窗**（默认开）：填完立刻继续打字
- **界面语言**：跟随浏览器 / 中文 / English（手动选择会覆盖浏览器语言，立即生效）
- **主题**：跟随系统 / 浅色 / 深色
- **提示词数据**：导出 JSON、导入 JSON、清空全部

扩展图标（工具栏）弹出的面板里还有：全局启用开关、默认插入方式、自动收起开关，以及「在当前标签页打开浮窗」。
关掉全局开关只是把浮窗从页面上移除，**提示词数据不会丢**。

> 关于语言：`_locales/` 决定扩展**名称与描述**在 `chrome://extensions` 里的显示语言（这个只能跟随浏览器），
> 浮窗与弹窗里的**界面文案**则由你自己的语言设置决定，两者互不影响。

---

## 五、数据与备份

提示词保存在 `chrome.storage.local` 的 `aipf.prompts`，设置保存在 `aipf.settings`。

- **导出**：`⚙ → 导出 JSON / Export JSON`，得到形如下面的文件（`prompts` 也可以直接是数组）
- **导入**：`⚙ → 导入 JSON / Import JSON`，会**整体替换**当前列表，所以导入前建议先导出备份
- **清空**：`⚙ → 清空全部 / Clear all`，二次确认后清空
- 多标签页之间自动同步（监听 `chrome.storage.onChanged`）

```json
{
  "app": "ai-prompt-float",
  "version": 1,
  "prompts": [
    { "title": "总结要点", "content": "请把下面的内容总结成三条要点：\n\n" },
    { "title": "Code review", "content": "Review the code below for bugs and readability issues:\n\n" }
  ]
}
```

> 想批量维护提示词：导出 → 在编辑器里改/加 → 导入覆盖。这是本扩展唯一的「批量编辑」入口，因为不预置任何内容。
> `title` 可以省略，会取内容的开头；`id` 省略会自动生成。

---

## 六、目录结构

```
ai-prompt-float/
├── manifest.json            # MV3 清单：站点匹配、权限、脚本注入顺序、_locales 引用
├── popup.html/.css/.js      # 工具栏弹窗（全局开关、默认行为、一键打开浮窗）
├── _locales/
│   ├── zh_CN/messages.json  # 扩展名/描述（Chrome 按浏览器语言选）
│   └── en/messages.json
├── icons/                   # 图标 16/48/128
├── src/
│   ├── i18n.js              # 中英文案表 + 语言解析（浮窗与弹窗共用）
│   ├── panel-style.js       # 浮窗样式（注入 Shadow DOM）
│   ├── insert.js            # 输入框定位 + 文本插入核心（不依赖 chrome.*）
│   └── content.js           # 浮窗 UI、交互、存储、按键护盾
├── test/
│   ├── harness.html         # 主功能断言页（模拟三种编辑器）
│   ├── hostile.html         # 敌意页面：模拟「打字即抢焦点」的站点
│   ├── cdp-typing.mjs       # 用 CDP 发真实按键验证按键护盾
│   ├── check-i18n.mjs       # 文案完整性静态检查
│   ├── site.html            # 端到端模拟页（模拟 ChatGPT 页面，手动用）
│   ├── run-tests.ps1        # 主功能断言
│   ├── run-popup-test.ps1   # 弹窗中英渲染检查
│   └── run-typing-test.ps1  # 按键护盾测试
└── tools/make-icons.py      # 重新生成图标
```

### 设计要点

- **样式隔离**：浮窗挂在 `attachShadow({mode:'open'})` 里，样式用 `adoptedStyleSheets` 注入，既不污染站点，也不受站点 CSP 影响
- **按键护盾**：ChatGPT / Grok 这类站点会监听全局按键实现「在页面任意处打字即聚焦聊天输入框」。浮窗在 Shadow DOM 里，站点看到的 `event.target` 被重定向成宿主节点、`document.activeElement` 也不是它的输入框，于是会把你的按键抢进聊天框。扩展在 **window 捕获阶段**用 `stopImmediatePropagation()` 截住来自浮窗的按键事件（只截传播、不 `preventDefault`，所以浏览器照常把字打进浮窗），站点完全看不到这些事件。为此内容脚本以 `document_start` 注入，保证监听器注册在站点脚本之前
- **国际化**：界面文案走自己的 [`src/i18n.js`](src/i18n.js) 而不是 `chrome.i18n.getMessage`——因为设置里允许手动覆盖语言，而 `chrome.i18n` 只会按浏览器语言返回，覆盖不了。`_locales` 只负责扩展名/描述这类由 Chrome 自己展示的字符串。切换语言时重建一次浮窗 DOM（文案在 HTML 里，重建最稳妥）
- **输入框定位**（`src/insert.js`）：先按站点专用选择器找，再按「是否聚焦 / 是否在屏幕下半部 / 面积 / 距底部距离」打分挑最优，顶部的搜索框会被降权
- **插入策略**：优先 `document.execCommand('insertText')`（原生路径，React/Vue 的 `onChange` 能感知、支持撤销）；失败则退化为构造 `paste` 事件；再失败才直接改 DOM 并补发 `input` 事件
- **React 受控 textarea**：走原生 `value` setter + 派发 `input`/`change`，避免被 React 的 value tracker 吞掉

---

## 七、测试

四套检查，除第 2 套需要 Node 外都不需要额外依赖：

```powershell
# 1) 主功能断言（21 项：定位、追加/覆盖、事件派发、contenteditable、浮窗挂载、
#    空列表引导、增删改、搜索、点击填入、语言切换与持久化、popup 消息通道）
powershell -NoProfile -ExecutionPolicy Bypass -File test\run-tests.ps1

# 2) 弹窗中英渲染检查（各 6 项，用真实 popup.html + chrome 桩）
powershell -NoProfile -ExecutionPolicy Bypass -File test\run-popup-test.ps1

# 3) 按键护盾测试（7 项，用 CDP 发送真实键盘事件）
powershell -NoProfile -ExecutionPolicy Bypass -File test\run-typing-test.ps1

# 4) 文案完整性静态检查（两份表 key 是否一致、有没有引用不存在的 key）
node test\check-i18n.mjs
```

当前结果：**21/21、6/6 ×2、7/7、i18n OK**。

第 1 套用无头 Chrome/Edge 打开 `test/harness.html`，也可以直接用浏览器打开这个页面手动点着玩，结果显示在右上角。

第 3 套最有意思：`test/hostile.html` 会模拟「在页面任意处打字即抢走按键」的敌意站点（同时在 `document` 和 `window` 捕获阶段抢键），`test/cdp-typing.mjs` 通过 CDP 的 `Input.dispatchKeyEvent` 发送**真实按键**，因此能真正验证两件事——字完整进入了浮窗输入框，且网页输入框一个字都没拿到。其中一条会临时关掉护盾来复现问题，确保测试本身是有效的（否则测试可能只是「假绿」）。

> 第 2、3 套需要 Node.js：22+ 最佳；20.10~21 的 `WebSocket` 需要 `--experimental-websocket`，脚本会自动加。脚本会自动找 Chrome/Edge 和 Node，也可以用 `-Browser` / `-Node` 指定。

`test/site.html` 是端到端页面：加载真实扩展后打开它，应该能看到浮窗、新建提示词、点一下能填进模拟输入框，刷新后仍在（验证 `chrome.storage` 持久化）。放在非 `chatgpt.com//127.0.0.1` 域名下时需要在 manifest 里临时加一条匹配。

---

## 八、常见问题

**页面上看不到浮窗，弹窗提示打不开**
最常见的原因是：标签页在扩展安装/重载之前就已经打开了。按 F5 刷新页面即可；或者点弹窗里的「在当前标签页打开浮窗」让扩展就地注入。
如果刷新后仍然没有，请确认：地址栏确实在 ChatGPT / Gemini / Grok / Kimi 域名上；以及 `chrome://extensions` 里该扩展没有报错（卡片上的「错误」按钮）。内容脚本的报错也会出现在网页 DevTools 的 Console 里，带扩展名。

**浮窗里是空的，没有提示词**
这是**预期行为**：本扩展不预置任何提示词。点空状态里的「新建提示词」，或到 `⚙ → 导入 JSON` 批量导入。

**界面语言不对 / 想换成英文**
`⚙ → 界面语言`，选 `English` 或 `中文`；选「跟随浏览器」则按浏览器界面语言自动决定。扩展在 `chrome://extensions` 里显示的名称只跟随浏览器语言，改不了。

**在浮窗的输入框里打字，打一个字就跳进网页的聊天输入框**
这是站点「在页面任意处打字即自动聚焦聊天输入框」的全局按键监听造成的，已由按键护盾解决。如果仍然出现，说明该站点的监听注册得比扩展更早（极罕见），请把网站名反馈给我。
另外，护盾要求内容脚本以 `document_start` 注入——如果你改过 `manifest.json` 的 `run_at`，请改回 `document_start`。

**点了提示词没反应 / 提示「没找到聊天输入框」**
先手动点一下网页上的聊天输入框把光标放进去，再点提示词。

**填入后网站没识别（发送按钮仍是灰的）**
说明该站点的编辑器拦截了程序化输入。用提示词右侧的 `⧉` 复制到剪贴板，手动 `Ctrl+V` 粘贴一次即可；同时欢迎把网站版本反馈给我，补一条适配规则。

**网站改版后定位不准**
打开 [`src/insert.js`](src/insert.js)，在 `SITE_RULES` 里给对应站点补一个选择器（数组里越靠前优先级越高），然后在 `chrome://extensions` 点「重新加载」并刷新网页。

**Kimi / Grok 的域名变了**
在 `manifest.json` 的 `content_scripts[0].matches` 里加一条 `https://新域名/*`，重新加载扩展。

**浮窗挡住界面 / 拖到奇怪的地方了**
`⚙ → 重置浮窗位置`，或按住圆形按钮拖回去。

**修改代码后没生效**
扩展是加载已解压目录，改完要在 `chrome://extensions` 点「重新加载」，并刷新目标网页；改 `manifest.json` 必须重新加载扩展。
