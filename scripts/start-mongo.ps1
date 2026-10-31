$ErrorActionPreference = 'Stop'
$workspacePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$mongoDataPath = [System.IO.Path]::GetFullPath((Join-Path $workspacePath '.local\mongo'))
if (-not $mongoDataPath.StartsWith($workspacePath + [System.IO.Path]::DirectorySeparatorChar)) { throw 'MongoDB path is outside the workspace.' }
$listening = Get-NetTCPConnection -State Listen -LocalPort 27018 -ErrorAction SilentlyContinue
if ($listening) { Write-Output 'A process is already listening on 27018. No database process was changed.'; exit 0 }
$mongoExecutable = 'C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe'
if (-not (Test-Path -LiteralPath $mongoExecutable)) { throw 'MongoDB 7.0 was not found. Update the executable path in this script for your installation.' }
New-Item -ItemType Directory -Path $mongoDataPath -Force | Out-Null
$mongoLogPath = Join-Path $workspacePath '.local\mongo.log'
$mongoArguments = @('--dbpath', ('"' + $mongoDataPath + '"'), '--port', '27018', '--replSet', 'megha', '--bind_ip', '127.0.0.1', '--logpath', ('"' + $mongoLogPath + '"'), '--logappend')
Start-Process -FilePath $mongoExecutable -ArgumentList $mongoArguments -WindowStyle Hidden
Write-Output 'Started the workspace MongoDB replica set on 127.0.0.1:27018.'
