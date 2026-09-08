param(
    [switch]$Worker,
    [string]$NodeExecutable,
    [string]$DockerExecutable,
    [string]$NpmDirectory
)

# Windows local development: keep the services independent of the launching terminal.
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$repo = Split-Path -Parent $PSScriptRoot
$scriptFile = $PSCommandPath
$runtime = Join-Path $repo '.local'
$logFile = Join-Path $runtime 'persistent-services.log'
$stateFile = Join-Path $runtime 'persistent-services.json'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null

if (-not $Worker) {
    $mutexName = 'Local\WemoveStart-' + (($repo -replace '[^a-zA-Z0-9]', '_'))
    $mutex = New-Object System.Threading.Mutex($false, $mutexName)
    if (-not $mutex.WaitOne(0)) { throw 'Another local startup is in progress.' }
    try {
        if (Test-Path -LiteralPath $stateFile) {
            $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($state.pid)"
            if ($existing -and $existing.CreationDate.ToUniversalTime().ToString('o') -eq $state.createdAt -and
                $existing.CommandLine.Contains($scriptFile) -and $existing.CommandLine.Contains('-Worker')) {
                Write-Output "Local service worker already running (PID $($state.pid)). Log: $logFile"
                return
            }
        }
        foreach ($port in @(3000, 8080)) {
            if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
                throw "Port $port is already in use. No processes were stopped."
            }
        }
        $NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
        $DockerExecutable = (Get-Command docker.exe -ErrorAction Stop).Source
        $NpmDirectory = Split-Path -Parent (Get-Command npm.cmd -ErrorAction Stop).Source
        $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
        $command = '"{0}" -NoProfile -NonInteractive -WindowStyle Hidden -File "{1}" -Worker -NodeExecutable "{2}" -DockerExecutable "{3}" -NpmDirectory "{4}"' -f $powershell, $scriptFile, $NodeExecutable, $DockerExecutable, $NpmDirectory
        $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{
            ShowWindow = [uint16]0
            CreateFlags = [uint32]16777216
        }
        $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine = $command
            CurrentDirectory = $repo
            ProcessStartupInformation = $startup
        }
        if ($result.ReturnValue -ne 0) { throw "Windows could not start the worker (code $($result.ReturnValue))." }
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($result.ProcessId)"
        if (-not $process) { throw "Worker exited during startup. Check $logFile" }
        @{
            pid = $process.ProcessId
            createdAt = $process.CreationDate.ToUniversalTime().ToString('o')
            executable = $process.ExecutablePath
            repo = $repo
            script = $scriptFile
            log = $logFile
        } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
        Write-Output "Started independent local service worker (PID $($process.ProcessId))."
        Write-Output "Startup log: $logFile"
        Write-Output 'Website after startup: http://localhost:3000'
    } finally {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    return
}

$env:PATH = "$NpmDirectory;$(Split-Path -Parent $NodeExecutable);$(Split-Path -Parent $DockerExecutable);$env:PATH"
Set-Location -LiteralPath $repo
"`n[$(Get-Date -Format o)] Starting local services" | Add-Content -LiteralPath $logFile
# Native tools may write progress to stderr; their exit code determines success.
$ErrorActionPreference = 'Continue'
& $DockerExecutable desktop start --timeout 90 *>> $logFile
& $DockerExecutable compose -f infra/docker-compose.yml up -d --wait --wait-timeout 60 *>> $logFile
if ($LASTEXITCODE -ne 0) { 'Infrastructure startup failed.' | Add-Content $logFile; exit 1 }
& (Join-Path $NpmDirectory 'npm.cmd') run prisma:deploy -w api *>> $logFile
if ($LASTEXITCODE -ne 0) { 'Database migration failed.' | Add-Content $logFile; exit 1 }
& $NodeExecutable (Join-Path $repo 'node_modules/concurrently/dist/bin/concurrently.js') -k --restart-tries 5 --restart-after 2000 -n WEB,API npm:dev:web npm:dev:api *>> $logFile
$serviceExitCode = $LASTEXITCODE
"[$(Get-Date -Format o)] Web/API launcher exited: $serviceExitCode" | Add-Content -LiteralPath $logFile
exit $serviceExitCode
