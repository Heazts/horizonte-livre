# Compatibilidade com o comando da primeira versão.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& node (Join-Path $projectRoot 'scripts\gerar-catalogo.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node (Join-Path $projectRoot 'scripts\validar.mjs')
exit $LASTEXITCODE
