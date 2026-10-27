$ErrorActionPreference = 'Stop'
if ($args.Count -eq 0) { $args = @((Get-Process -Id $PID).Path, '-NoExit') }
& mise exec -- @args
exit $LASTEXITCODE
