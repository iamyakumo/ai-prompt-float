# 用无头 Chrome + CDP 真实键盘事件验证「浮窗输入不被网页抢走」。
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File test\run-typing-test.ps1
#   pwsh -File test\run-typing-test.ps1
param(
    [string]$Browser,
    [string]$Node,
    [int]$Port = 9333
)

$ErrorActionPreference = 'Stop'

$testDir = $PSScriptRoot
$page = Join-Path $testDir 'hostile.html'
$script = Join-Path $testDir 'cdp-typing.mjs'
if (-not (Test-Path $page)) { throw "找不到测试页：$page" }

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

if (-not $Node) {
    $bundled = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path $bundled) { $Node = $bundled }
    else {
        $cmd = Get-Command node -ErrorAction SilentlyContinue
        if ($cmd) { $Node = $cmd.Source }
    }
}
if (-not $Node) { throw '没找到 Node.js，可用 -Node 指定路径。' }

# Node 22+ 自带 WebSocket；Node 20.10~21 需要 --experimental-websocket
$nodeArgs = @()
$ws = (& $Node -e "console.log(typeof WebSocket)" 2>$null | Select-Object -Last 1)
if ("$ws".Trim() -ne 'function') {
    $wsFlagged = (& $Node --experimental-websocket -e "console.log(typeof WebSocket)" 2>$null | Select-Object -Last 1)
    if ("$wsFlagged".Trim() -eq 'function') { $nodeArgs += '--experimental-websocket' }
    else { throw "Node $(& $Node -v) 不支持 WebSocket，请升级到 Node 22+（或 Node 20.10+ 并允许 --experimental-websocket）。" }
}

$url = 'file:///' + ($page -replace '\\', '/')
$profile = Join-Path $env:TEMP ('aipf-typing-' + [guid]::NewGuid().ToString('N').Substring(0, 8))

Write-Host "浏览器：$Browser"
Write-Host "Node  ：$Node"
Write-Host "测试页：$url"

$chrome = Start-Process -FilePath $Browser -PassThru -ArgumentList @(
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', "--remote-debugging-port=$Port", "--user-data-dir=$profile",
    '--window-size=1280,900', $url
)

try {
    # 等调试端口就绪
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null
            $ok = $true
            break
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ok) { throw "Chrome 调试端口 $Port 没有就绪。" }

    & $Node @nodeArgs $script $Port 'hostile.html'
    $code = $LASTEXITCODE
} finally {
    if ($chrome -and -not $chrome.HasExited) { Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 400
    Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
}

exit $code
