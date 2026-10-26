# 运行 test/harness.html（无需安装任何依赖），打印断言结果。
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File test\run-tests.ps1
#   pwsh -File test\run-tests.ps1        # PowerShell 7
param(
    [string]$Browser
)

$ErrorActionPreference = 'Stop'

$extRoot = Split-Path -Parent $PSScriptRoot
$harness = Join-Path $PSScriptRoot 'harness.html'
if (-not (Test-Path $harness)) { throw "找不到测试页：$harness" }

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
if (-not $Browser -or -not (Test-Path $Browser)) { throw '没找到 Chrome / Edge，可用 -Browser 指定可执行文件路径。' }

$url = 'file:///' + ($harness -replace '\\', '/')
$profile = Join-Path $env:TEMP ('aipf-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8))

Write-Host "浏览器：$Browser"
Write-Host "测试页：$url"

try {
    $output = & $Browser --headless=new --disable-gpu --no-first-run --no-default-browser-check `
        --disable-extensions --user-data-dir="$profile" --virtual-time-budget=6000 `
        --window-size=1280,900 --dump-dom $url 2>&1 | Out-String
} finally {
    Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
}

$text = $output -replace "`r", ''
$start = $text.IndexOf('AIPF-RESULT')
if ($start -lt 0) {
    Write-Host $text
    throw '测试没有产出结果，页面可能加载失败。'
}
$end = $text.IndexOf('</pre>', $start)
$block = if ($end -gt $start) { $text.Substring($start, $end - $start) } else { $text.Substring($start) }

Write-Host ''
Write-Host $block

if ($block -match 'FAIL') { exit 1 }
Write-Host ''
Write-Host '全部通过 ✅'
exit 0
