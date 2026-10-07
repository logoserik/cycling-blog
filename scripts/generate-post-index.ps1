$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$postsDir = Join-Path $root "wwwroot\content\posts"
$indexPath = Join-Path $root "wwwroot\content\index.json"

if (-not (Test-Path $postsDir)) {
    New-Item -ItemType Directory -Path $postsDir -Force | Out-Null
}

$slugs = Get-ChildItem -Path $postsDir -Filter *.md -File |
    Sort-Object Name |
    ForEach-Object { $_.BaseName }

$payload = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    posts = @($slugs | ForEach-Object { [ordered]@{ slug = $_ } })
}

$json = $payload | ConvertTo-Json -Depth 4
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($indexPath, $json + [Environment]::NewLine, $utf8NoBom)

Write-Host "Wrote $($slugs.Count) post(s) to wwwroot/content/index.json"
