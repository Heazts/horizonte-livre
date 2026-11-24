[CmdletBinding()]
param(
    [string]$SourceDirectory,
    [string]$OutputDirectory,
    [string]$CatalogDirectory,
    [Int64]$MaximumUncompressedBytes = 5368709120,
    [int]$MaximumEntriesPerArchive = 2000
)

<#
.SYNOPSIS
Extrai ZIPs para triagem sem alterar os originais.

.DESCRIPTION
Valida todos os caminhos antes de gravar, limita tamanho e quantidade de
entradas e gera um catálogo de procedência. Extração não é autorização de
publicação: todo item gerado começa em revisao_de_direitos.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($SourceDirectory)) {
    $SourceDirectory = Split-Path -Parent $projectRoot
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot 'acervo\triagem'
}
if ([string]::IsNullOrWhiteSpace($CatalogDirectory)) {
    $CatalogDirectory = Join-Path $projectRoot 'catalogo'
}

function ConvertTo-Slug {
    param([Parameter(Mandatory)][string]$Value)

    $normalized = $Value.Normalize([System.Text.NormalizationForm]::FormD)
    $withoutMarks = [regex]::Replace($normalized, '\p{Mn}', '')
    $slug = [regex]::Replace($withoutMarks.ToLowerInvariant(), '[^a-z0-9]+', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) { return 'colecao' }
    return $slug
}

function Get-SafeDestination {
    param(
        [Parameter(Mandatory)][string]$EntryPath,
        [Parameter(Mandatory)][string]$ExtractionRoot
    )

    if ([System.IO.Path]::IsPathRooted($EntryPath) -or $EntryPath -match '(^|[\\/])\.{1,2}([\\/]|$)') {
        throw "Caminho inseguro no ZIP: $EntryPath"
    }

    $segments = @($EntryPath -split '[\\/]' | Where-Object { $_.Length -gt 0 })
    if ($segments.Count -eq 0) {
        throw "Caminho vazio no ZIP: $EntryPath"
    }

    $safeSegments = foreach ($segment in $segments) {
        if ($segment.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
            throw "Segmento incompatível com Windows no ZIP: $segment"
        }
        $safeSegment = $segment.TrimEnd([char[]]@(' ', '.'))
        if ([string]::IsNullOrWhiteSpace($safeSegment)) {
            throw "Segmento vazio após normalização no ZIP: $segment"
        }
        if ($safeSegment -match '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$') {
            throw "Nome reservado do Windows no ZIP: $segment"
        }
        $safeSegment
    }

    $relativePath = [string]::Join([System.IO.Path]::DirectorySeparatorChar, [string[]]$safeSegments)
    $destination = [System.IO.Path]::GetFullPath((Join-Path $ExtractionRoot $relativePath))
    $rootWithSeparator = $ExtractionRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $destination.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "A entrada sairia da área de extração: $EntryPath"
    }
    return $destination
}

function Get-ProjectRelativePath {
    param(
        [Parameter(Mandatory)][string]$ProjectRoot,
        [Parameter(Mandatory)][string]$TargetPath
    )

    $projectWithSeparator = $ProjectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $TargetPath.StartsWith($projectWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "A pasta de saída precisa ficar dentro do projeto: $TargetPath"
    }
    return $TargetPath.Substring($projectWithSeparator.Length)
}

$sourceRoot = [System.IO.Path]::GetFullPath($SourceDirectory)
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$catalogRoot = [System.IO.Path]::GetFullPath($CatalogDirectory)
$projectRootPath = [System.IO.Path]::GetFullPath($projectRoot)
$catalogOutputRoot = (Get-ProjectRelativePath -ProjectRoot $projectRootPath -TargetPath $outputRoot) -replace '\\', '/'

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "Pasta de origem não encontrada: $sourceRoot"
}

$archives = @(Get-ChildItem -LiteralPath $sourceRoot -File -Filter '*.zip' | Sort-Object Name)
if ($archives.Count -eq 0) {
    throw "Nenhum ZIP encontrado em: $sourceRoot"
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
New-Item -ItemType Directory -Path $catalogRoot -Force | Out-Null

$collections = [System.Collections.Generic.List[object]]::new()
$resources = [System.Collections.Generic.List[object]]::new()
$usedSlugs = @{}

foreach ($archiveFile in $archives) {
    $baseSlug = ConvertTo-Slug $archiveFile.BaseName
    $slug = $baseSlug
    $suffix = 2
    while ($usedSlugs.ContainsKey($slug)) {
        $slug = "$baseSlug-$suffix"
        $suffix++
    }
    $usedSlugs[$slug] = $true

    $destinationRoot = Join-Path $outputRoot $slug
    $stagingRoot = Join-Path $outputRoot ('.' + $slug + '.extraindo')
    if (Test-Path -LiteralPath $destinationRoot) {
        throw "A pasta de destino já existe e não será sobrescrita: $destinationRoot"
    }
    if (Test-Path -LiteralPath $stagingRoot) {
        throw "Há uma extração parcial preservada em: $stagingRoot. Revise-a ou renomeie-a antes de executar novamente."
    }

    Write-Host "Validando e extraindo: $($archiveFile.Name)"
    $archiveSha256 = (Get-FileHash -LiteralPath $archiveFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $archive = [System.IO.Compression.ZipFile]::OpenRead($archiveFile.FullName)

    try {
        $entries = @($archive.Entries | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Name) })
        if ($entries.Count -gt $MaximumEntriesPerArchive) {
            throw "O ZIP $($archiveFile.Name) ultrapassa $MaximumEntriesPerArchive arquivos."
        }

        [Int64]$uncompressedBytes = 0
        $destinations = @{}
        foreach ($entry in $entries) {
            if ($entry.FullName.IndexOf([char]0) -ge 0) {
                throw "A entrada contém caractere nulo: $($entry.FullName)"
            }
            $validatedDestination = Get-SafeDestination -EntryPath $entry.FullName -ExtractionRoot $stagingRoot
            $destinationKey = $validatedDestination.ToUpperInvariant()
            if ($destinations.ContainsKey($destinationKey)) {
                throw "Duas entradas seriam gravadas no mesmo destino: $($destinations[$destinationKey]) e $($entry.FullName)"
            }
            $destinations[$destinationKey] = $entry.FullName
            $uncompressedBytes += [Int64]$entry.Length
        }
        if ($uncompressedBytes -gt $MaximumUncompressedBytes) {
            throw "O ZIP $($archiveFile.Name) excede o limite de tamanho configurado."
        }

        New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
        $fileNumber = 0
        foreach ($entry in $entries) {
            $destination = Get-SafeDestination -EntryPath $entry.FullName -ExtractionRoot $stagingRoot
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination)

            $fileNumber++
            $extractedRelativePath = $destination.Substring($stagingRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)
            $resources.Add([PSCustomObject]@{
                id                   = ('{0}-{1:D4}' -f $slug, $fileNumber)
                colecaoId            = $slug
                arquivoOriginal      = $archiveFile.Name
                caminhoNoArquivo     = $entry.FullName
                caminhoExtraido      = ('{0}/{1}/{2}' -f $catalogOutputRoot.TrimEnd('/'), $slug, ($extractedRelativePath -replace '\\', '/'))
                nomeNormalizadoParaWindows = (($entry.FullName -replace '\\', '/') -ne ($extractedRelativePath -replace '\\', '/'))
                titulo               = [System.IO.Path]::GetFileNameWithoutExtension($entry.Name)
                extensao             = [System.IO.Path]::GetExtension($entry.Name).ToLowerInvariant()
                tamanhoBytes         = [Int64]$entry.Length
                statusPublicacao     = 'revisao_de_direitos'
                observacaoPublicacao = 'Extraído para triagem; não publicar sem confirmar fonte e permissão.'
            })
        }

        Move-Item -LiteralPath $stagingRoot -Destination $destinationRoot -ErrorAction Stop
        $collections.Add([PSCustomObject]@{
            id                   = $slug
            titulo               = $archiveFile.BaseName
            arquivoOriginal      = $archiveFile.Name
            sha256Arquivo        = $archiveSha256
            tamanhoZipBytes      = [Int64]$archiveFile.Length
            tamanhoExtraidoBytes = $uncompressedBytes
            quantidadeArquivos   = $entries.Count
            statusPublicacao     = 'revisao_de_direitos'
        })
    }
    catch {
        if (Test-Path -LiteralPath $stagingRoot) {
            Write-Warning "A extração parcial foi preservada em $stagingRoot para revisão."
        }
        throw
    }
    finally {
        $archive.Dispose()
    }
}

$catalog = [PSCustomObject]@{
    esquema   = 'ponte-de-estudos/catalogo-v1'
    geradoEm  = (Get-Date).ToUniversalTime().ToString('o')
    aviso     = 'Este catálogo descreve materiais em triagem. A inclusão aqui não autoriza redistribuição pública.'
    colecoes  = $collections
    recursos  = $resources
}

$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
$catalogPath = Join-Path $catalogRoot 'recursos.json'
[System.IO.File]::WriteAllText($catalogPath, ($catalog | ConvertTo-Json -Depth 6), $utf8WithoutBom)

Write-Host ''
Write-Host "Extração concluída: $($collections.Count) coleções e $($resources.Count) arquivos."
Write-Host "Catálogo gerado: $catalogPath"
