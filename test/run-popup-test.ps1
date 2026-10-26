# 渲染测试：用真实的 popup.html + popup.js，配上 chrome API 桩，检查中英两种语言下的渲染结果。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File test\run-popup-test.ps1
param(
    [string]$Browser
)

$ErrorActionPreference = 'Stop'

$ext = Split-Path -Parent $PSScriptRoot
$popup = Join-Path $ext 'popup.html'
if (-not (Test-Path $popup)) { throw "找不到 popup.html：$popup" }

if (-not $Browser) {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    $Browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Browser) { throw '没找到 Chrome / Edge，可用 -Browser 指定路径。' }

# 生成临时测试页：真实 popup.html + chrome 桩 + 断言脚本
$base = 'file:///' + ($ext -replace '\\', '/')
$html = Get-Content $popup -Raw

$stub = @"
    <script>
      // chrome API 桩：语言由 URL hash 决定（#en / 默认跟随 chrome.i18n 返回的 zh-CN）
      const __settings = { enabled: true, mode: 'replace', theme: 'auto',
        lang: location.hash === '#en' ? 'en' : 'auto', autoHide: false,
        pos: { right: 22, bottom: 96 }, open: false };
      window.chrome = {
        i18n: { getUILanguage: () => 'zh-CN' },
        runtime: { lastError: null },
        storage: {
          local: {
            get(keys, cb) { setTimeout(() => cb({ 'aipf.settings': __settings,
              'aipf.prompts': [{ title: 't', content: 'c' }] }), 0); },
            set(obj, cb) { if (cb) cb(); },
          },
          onChanged: { addListener() {} },
        },
        tabs: { query: (q, cb) => cb([{ id: 1 }]), sendMessage: (id, m, cb) => cb({ ok: false }) },
        scripting: { executeScript: async () => { throw new Error('not used'); } },
      };
    </script>
"@

$html = $html -replace 'href="popup\.css"', "href=`"$base/popup.css`""
$html = $html -replace 'src="icons/icon48\.png"', "src=`"$base/icons/icon48.png`""
$html = $html -replace '<script src="src/i18n\.js"></script>', ($stub + "    <script src=`"$base/src/i18n.js`"></script>")
$html = $html -replace 'src="popup\.js"', "src=`"$base/popup.js`""

$checker = @"
    <pre id="test-output" style="position:fixed;left:-9999px">running</pre>
    <script>
      (async function () {
        await new Promise((r) => setTimeout(r, 300));
        const log = [];
        const check = (n, ok, extra) => log.push((ok ? 'PASS' : 'FAIL') + ' | ' + n + (extra ? '  -> ' + extra : ''));
        const txt = (sel) => { const n = document.querySelector(sel); return n ? n.textContent : ''; };
        const en = location.hash === '#en';
        try {
          check('扩展名已本地化', txt('.name') === (en ? 'AI Prompt Dock' : 'AI 提示词浮窗'), txt('.name'));
          check('提示词数量文案', txt('#count') === (en ? '1 prompts saved' : '已保存 1 条提示词'), txt('#count'));
          check('按钮文案已本地化', txt('#open') === (en ? 'Open the panel in this tab' : '在当前标签页打开浮窗'), txt('#open'));
          check('开关已回填', document.getElementById('enabled').checked === true &&
            document.getElementById('autoHide').checked === false, 'enabled/autoHide');
          const modes = [...document.querySelectorAll('input[name="mode"]')].filter((r) => r.checked).map((r) => r.value);
          check('插入方式已回填', modes.length === 1 && modes[0] === 'replace', modes.join(','));
          const miss = [...document.querySelectorAll('[data-i18n]')]
            .filter((n) => n.textContent === n.getAttribute('data-i18n'))
            .map((n) => n.getAttribute('data-i18n'));
          check('没有漏翻的 key', miss.length === 0, miss.join(','));
        } catch (e) {
          check('渲染过程中未抛异常', false, String(e));
        }
        const pass = log.filter((l) => l.indexOf('PASS') === 0).length;
        document.getElementById('test-output').textContent =
          'AIPF-POPUP ' + pass + '/' + log.length + '\n' + log.join('\n');
        document.title = 'POPUP ' + pass + '/' + log.length;
      })();
    </script>
"@

$html = $html -replace '</body>', ($checker + '</body>')

$tmp = Join-Path $env:TEMP ('aipf-popup-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.html')
Set-Content -Path $tmp -Value $html -Encoding UTF8
$url = 'file:///' + ($tmp -replace '\\', '/')

Write-Host "浏览器：$Browser"
Write-Host "测试页：$url（基于真实 popup.html 生成）"
Write-Host ''

$failed = $false
foreach ($case in @(@{ hash = '#zh'; name = '中文（跟随 chrome.i18n 的 zh-CN）' },
                    @{ hash = '#en'; name = 'English（面板设置里覆盖成 en）' })) {
    $profile = Join-Path $env:TEMP ('aipf-popup-prof-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    try {
        $out = & $Browser --headless=new --disable-gpu --no-first-run --no-default-browser-check `
            --disable-extensions --user-data-dir="$profile" --virtual-time-budget=4000 `
            --window-size=420,700 --dump-dom "$url$($case.hash)" 2>&1 | Out-String
    } finally {
        Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
    }
    $text = $out -replace "`r", ''
    $i = $text.IndexOf('AIPF-POPUP')
    Write-Host ("—— {0} ——" -f $case.name)
    if ($i -lt 0) {
        Write-Host '  没拿到结果，页面可能加载失败'
        $failed = $true
    } else {
        $j = $text.IndexOf('</pre>', $i)
        $block = if ($j -gt $i) { $text.Substring($i, $j - $i) } else { $text.Substring($i) }
        Write-Host $block
        if ($block -match 'FAIL') { $failed = $true }
    }
    Write-Host ''
}

Remove-Item -Force $tmp -ErrorAction SilentlyContinue
if ($failed) { exit 1 }
Write-Host '弹窗渲染检查通过 ✅'
exit 0
