# 미니게임 빙고 - 데이터 변환 스크립트
# 자료 폴더(이미지/txt) -> bingo-app/data/games.json + bingo-app/assets/* (익명 ID 복사)
# 실행: powershell -ExecutionPolicy Bypass -File tools\build-data.ps1

$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding $false   # UTF-8 (BOM 없음)

$app        = Split-Path -Parent (Split-Path -Parent $PSCommandPath)  # = ...\bingo-app
$root       = Split-Path -Parent $app                                # = ...\Workshop
$srcRoot    = $root
$assetsRoot = Join-Path $app 'assets'
$dataDir    = Join-Path $app 'data'

New-Item -ItemType Directory -Force -Path $assetsRoot, $dataDir | Out-Null

function Copy-Asset($srcFullPath, $cat, $name) {
  $destDir = Join-Path $assetsRoot $cat
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $ext = [System.IO.Path]::GetExtension($srcFullPath).ToLower()
  if ($ext -eq '.jpeg') { $ext = '.jpg' }
  $destName = "$name$ext"
  Copy-Item -LiteralPath $srcFullPath -Destination (Join-Path $destDir $destName) -Force
  return "assets/$cat/$destName"
}

$quizGames    = [ordered]@{}
$offlineGames = [ordered]@{}

# 의미 힌트(항목마다 작성) 로드
$hintsPath = Join-Path $PSScriptRoot 'hints.json'
$hints = if (Test-Path -LiteralPath $hintsPath) { Get-Content -LiteralPath $hintsPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
function Get-Hint($cat, $key) {
  if (-not $hints) { return '' }
  $c = $hints.$cat
  if (-not $c) { return '' }
  $v = $c.$key
  if ($v) { return [string]$v } else { return '' }
}

# ---------- 1) 가구 -> 브랜드 ----------
$pool = @(); $i = 0
Get-ChildItem -LiteralPath (Join-Path $srcRoot '퀴즈_가구') -File | Sort-Object Name | ForEach-Object {
  $i++; $id = 'furniture-{0:D2}' -f $i
  $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $parts = $base -split '_', 2
  $brand = $parts[0].Trim()
  $product = if ($parts.Count -gt 1) { $parts[1].Trim() } else { '' }
  $img = Copy-Asset $_.FullName 'furniture' $id
  $pool += [ordered]@{ id = $id; image = $img; answer = $brand; sub = $product }
}
$quizGames['furniture'] = [ordered]@{
  id = 'furniture'; title = '가구 보고 브랜드 맞히기'; type = 'image-choice'
  prompt = '이 가구의 브랜드는?'; answerLabel = '브랜드'; pool = $pool
}

# ---------- 2) 로고 -> 회사/브랜드 ----------
$pool = @(); $i = 0
Get-ChildItem -LiteralPath (Join-Path $srcRoot '퀴즈_로고') -File | Sort-Object Name | ForEach-Object {
  $i++; $id = 'logo-{0:D2}' -f $i
  $answer = [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Trim()
  $img = Copy-Asset $_.FullName 'logo' $id
  $pool += [ordered]@{ id = $id; image = $img; answer = $answer; sub = ''; hint = (Get-Hint 'logo' $answer) }
}
$quizGames['logo'] = [ordered]@{
  id = 'logo'; title = '로고 보고 브랜드 맞히기'; type = 'image-choice'
  prompt = '이 로고의 회사/브랜드는?'; answerLabel = '브랜드'; pool = $pool
}

# ---------- 3) 영화 장면 -> 제목 ----------
$pool = @(); $i = 0
Get-ChildItem -LiteralPath (Join-Path $srcRoot '퀴즈_영화') -File | Sort-Object Name | ForEach-Object {
  $i++; $id = 'movie-{0:D2}' -f $i
  $answer = [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Trim()
  $img = Copy-Asset $_.FullName 'movie' $id
  $pool += [ordered]@{ id = $id; image = $img; answer = $answer; sub = ''; hint = (Get-Hint 'movie' $answer) }
}
$quizGames['movie'] = [ordered]@{
  id = 'movie'; title = '영화 장면 보고 제목 맞히기'; type = 'image-choice'
  prompt = '이 장면이 나오는 영화는?'; answerLabel = '영화 제목'; pool = $pool
}

# ---------- 4) 아이돌 그룹 ----------
$pool = @(); $i = 0
Get-ChildItem -LiteralPath (Join-Path $srcRoot '퀴즈_아이돌') -File |
  Where-Object { $_.Extension -ne '.crdownload' -and $_.Name -notlike '미확인*' } |
  Sort-Object Name | ForEach-Object {
    $i++; $id = 'idol-{0:D2}' -f $i
    $answer = [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Trim()
    $img = Copy-Asset $_.FullName 'idol' $id
    $pool += [ordered]@{ id = $id; image = $img; answer = $answer; sub = ''; hint = (Get-Hint 'idol' $answer) }
  }
$quizGames['idol'] = [ordered]@{
  id = 'idol'; title = '사진 보고 아이돌 그룹 맞히기'; type = 'image-choice'
  prompt = '이 아이돌 그룹의 이름은?'; answerLabel = '그룹명'; pool = $pool
}

# ---------- 5) 색깔 -> 캐릭터 (색막대 문제 + 정답 이미지) ----------
$groups = @{}
Get-ChildItem -LiteralPath (Join-Path $srcRoot '퀴즈_캐릭터') -File |
  Where-Object { $_.Extension -in '.jpg', '.jpeg', '.png' } |
  ForEach-Object {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $plus = $base.IndexOf('+')
    if ($plus -lt 0) { $name = $base.Trim(); $work = '' }
    else { $name = $base.Substring(0, $plus).Trim(); $work = $base.Substring($plus + 1).Trim() }
    if (-not $groups.ContainsKey($name)) { $groups[$name] = @{ name = $name; q = $null; reveal = $null; work = '' } }
    if ([string]::IsNullOrEmpty($work)) { $groups[$name].q = $_.FullName }      # 색막대(문제)
    else { $groups[$name].reveal = $_.FullName; $groups[$name].work = $work }   # 정답 이미지
  }
$pool = @(); $i = 0
foreach ($name in ($groups.Keys | Sort-Object)) {
  $g = $groups[$name]
  if (-not $g.q -or -not $g.reveal) {
    Write-Warning "캐릭터 '$name' : 문제/정답 이미지 한 쪽 누락 -> 건너뜀"
    continue
  }
  $i++; $id = 'character-{0:D2}' -f $i
  $imgQ = Copy-Asset $g.q 'character' $id
  $imgR = Copy-Asset $g.reveal 'character' "$id-reveal"
  $pool += [ordered]@{ id = $id; image = $imgQ; reveal = $imgR; answer = $g.name; sub = $g.work; hint = (Get-Hint 'character' $g.name) }
}
$quizGames['character'] = [ordered]@{
  id = 'character'; title = '색깔 보고 캐릭터 맞히기'; type = 'image-choice'
  prompt = '이 색의 주인공 캐릭터는?'; answerLabel = '캐릭터'; pool = $pool
}

# ---------- 6) 넌센스 퀴즈 (txt) ----------
$pool = @(); $i = 0
$lines = Get-Content -LiteralPath (Join-Path $srcRoot '퀴즈_넌센스\넌센스.txt') -Encoding UTF8
$curQ = $null
foreach ($line in $lines) {
  $t = $line.Trim()
  if ($t -match '문제:\s*(.+)$') { $curQ = $Matches[1].Trim() }
  elseif ($t -match '정답:\s*(.+)$' -and $curQ) {
    $i++; $id = 'nonsense-{0:D2}' -f $i
    $nsAns = $Matches[1].Trim()
    $pool += [ordered]@{ id = $id; question = $curQ; answer = $nsAns; hint = (Get-Hint 'nonsense' $nsAns) }
    $curQ = $null
  }
}
$quizGames['nonsense'] = [ordered]@{
  id = 'nonsense'; title = '넌센스 퀴즈'; type = 'text-choice'
  prompt = ''; answerLabel = '정답'; pool = $pool
}

# ---------- 7) 몸으로 말해요 (온라인+오프라인, 속담 풀) ----------
$pool = @(); $i = 0
$lines = Get-Content -LiteralPath (Join-Path $srcRoot '피지컬_몸으로 말해요\몸으로 말해요.txt') -Encoding UTF8
foreach ($line in $lines) {
  $t = $line.Trim()
  if ($t -match '^\d+\.\s*(.+?)\s*\((쉬움|보통|어려움)\)\s*$') {
    $i++; $id = 'charade-{0:D2}' -f $i
    $pool += [ordered]@{ id = $id; phrase = $Matches[1].Trim(); level = $Matches[2] }
  }
}
$offlineGames['charade'] = [ordered]@{
  id = 'charade'; title = '몸으로 말해요'; type = 'charade'
  prompt = '제시어를 몸으로 설명하세요'; pool = $pool
}

# ---------- 8,9) 순수 오프라인 ----------
$offlineGames['thigh'] = [ordered]@{ id = 'thigh'; title = '허벅지 씨름'; type = 'offline'; prompt = '진행자 판정' }
$offlineGames['cup']   = [ordered]@{ id = 'cup';   title = '팀플 컵쌓기'; type = 'offline'; prompt = '진행자 판정' }

# ---------- 빙고판 9칸 배치 (행 우선) ----------
$boardLayout = @(
  'furniture', 'logo', 'movie',
  'character', 'idol', 'nonsense',
  'charade', 'thigh', 'cup'
)

# ---------- 출력 ----------
$out = [ordered]@{
  meta = [ordered]@{
    generatedAt = (Get-Date).ToString('s')
    quizPickCount = 10           # 퀴즈당 문제 수
    choiceCount   = 4            # 4지선다
    winLines      = 2            # 아무 두 줄
  }
  boardLayout  = $boardLayout
  quizGames    = $quizGames
  offlineGames = $offlineGames
}

$json = $out | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText((Join-Path $dataDir 'games.json'), $json, $enc)

# ---------- 요약 ----------
Write-Host ''
Write-Host '=== 데이터 변환 완료 ===' -ForegroundColor Green
foreach ($k in $quizGames.Keys)    { Write-Host ("  퀴즈 {0,-10} : {1} 문항" -f $k, $quizGames[$k].pool.Count) }
foreach ($k in $offlineGames.Keys) {
  $cnt = if ($offlineGames[$k].pool) { "$($offlineGames[$k].pool.Count) 제시어" } else { '판정형' }
  Write-Host ("  오프 {0,-10} : {1}" -f $k, $cnt)
}
Write-Host ("  -> {0}" -f (Join-Path $dataDir 'games.json'))
