$ErrorActionPreference = 'Stop'
if ($args.Count -eq 0) {
    $initializePrompt = @'
$global:FjsOriginalPrompt = $function:prompt
function global:prompt { 'FJS ' + (& $global:FjsOriginalPrompt) }
'@
    $args = @((Get-Process -Id $PID).Path, '-NoExit', '-Command', $initializePrompt)
}
& mise exec -- @args
exit $LASTEXITCODE
