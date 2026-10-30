[CmdletBinding()]
param([string]$Destination = (Join-Path $PSScriptRoot '..\repos'))

$ErrorActionPreference = 'Continue'
$env:GIT_LFS_SKIP_SMUDGE = '1'

$repositories = @(
    @{ Repo = 'ikeikeikeike/go-sitemap-generator'; Branch = 'master'; DirName = 'go-sitemap-generator-master' },
    @{ Repo = 'iamvishnusankar/next-sitemap'; Branch = 'master'; DirName = 'next-sitemap-master' },
    @{ Repo = 'RumenDamyanov/php-sitemap'; Branch = 'master'; DirName = 'php-sitemap-master' },
    @{ Repo = 'gokulmhegde/Laravel-YoastSeo'; Branch = 'master'; DirName = 'Laravel-YoastSeo-master' },
    @{ Repo = 'vezaynk/Sitemap-Generator-Crawler'; Branch = 'master'; DirName = 'Sitemap-Generator-Crawler-master' },
    @{ Repo = 'IlusionDev/nextjs-sitemap-generator'; Branch = 'master'; DirName = 'sitemap-generator-master' },
    @{ Repo = 'IlusionDev/nextjs-sitemap-generator'; Branch = ''; DirName = 'sitemap-generator-master_2' },
    @{ Repo = 'ekalinin/sitemap.js'; Branch = 'master'; DirName = 'sitemap.js-master' },
    @{ Repo = 'IlusionDev/nextjs-sitemap-generator'; Branch = 'master'; DirName = 'sitemap_generator-master' },
    @{ Repo = 'janreges/siteone-crawler-gui'; Branch = 'master'; DirName = 'siteone-crawler-gui-master' },
    @{ Repo = 'jasongitmail/super-sitemap'; Branch = 'main'; DirName = 'super-sitemap-main' },
)

$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path $resolvedDestination | Out-Null

$results = foreach ($item in $repositories) {
    $target = Join-Path $resolvedDestination $item.DirName
    if (Test-Path -LiteralPath $target) { [pscustomobject]@{Repo=$item.Repo;Status="present";Path=$target}; continue }
    if ($item.Branch) {
        & git clone --depth 1 --branch $item.Branch --single-branch "https://github.com/$($item.Repo).git" $target
    } else {
        & git clone --depth 1 "https://github.com/$($item.Repo).git" $target
    }
    [pscustomobject]@{Repo=$item.Repo;Status=(if($LASTEXITCODE -eq 0){"cloned"}else{"failed"});Path=$target}
}
$results | Format-Table -AutoSize
if ($results.Status -contains "failed") { Write-Warning "Algunos repos fallaron - revisa manualmente." }
