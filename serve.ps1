# 미니게임 빙고 - 로컬 미리보기 서버 (Node/Python 불필요)
# 실행:  powershell -ExecutionPolicy Bypass -File serve.ps1
# 종료:  Ctrl+C
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$rootDir = Split-Path -Parent $PSCommandPath

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.webp' = 'image/webp'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "미니게임 빙고 서버 실행 중 -> $prefix" -ForegroundColor Green
Write-Host "루트: $rootDir"
Write-Host "종료하려면 Ctrl+C" -ForegroundColor Yellow

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $path = Join-Path $rootDir $rel
      if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }

      if (Test-Path -LiteralPath $path -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
