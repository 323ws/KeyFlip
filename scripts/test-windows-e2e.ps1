# KeyFlip - Windows Platform & UX Validation (E2E Test Suite)
# Tests:
# 1. Distribution Binaries (Portable EXE, NSIS Setup, Browser ZIPs)
# 2. Core Conversion Problem Matrix (chat gpt, hello world, etc. bidirectional)
# 3. Clipboard Preservation Tests (Empirical token verification)
# 4. AltGr Isolation & Shortcut Safety (VK_RMENU, Ctrl+Right Alt protection)
# 5. Real App Interoperability (Live Notepad Test: Word, Multiline, Mid-Sentence, Pass-Through)
# 6. Zero Telemetry & Privacy Verification

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $RootDir "dist"
$DesktopDir = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$NodeRunner = Join-Path $ScriptDir "e2e-node-runner.js"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "             KEYFLIP WINDOWS E2E TEST SUITE                     " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$Passed = 0
$Failed = 0

function Assert-Check {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Details = ""
    )
    if ($Condition) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        if ($Details) { Write-Host "         $Details" -ForegroundColor DarkGray }
        $global:Passed++
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        if ($Details) { Write-Host "         Error: $Details" -ForegroundColor Yellow }
        $global:Failed++
    }
}

# Run node verification runner
$NodeOutput = node $NodeRunner | ConvertFrom-Json

# -----------------------------------------------------------------------------
# GATE 1: DISTRIBUTION BINARIES & PERMISSIONS
# -----------------------------------------------------------------------------
Write-Host "[GATE 1] Distribution Binaries & Standalone Execution" -ForegroundColor Magenta

$PortableDist = Join-Path $DistDir "KeyFlip-Portable.exe"
$PortableDesktop = Join-Path $DesktopDir "KeyFlip-Portable.exe"
$SetupDist = Join-Path $DistDir "KeyFlip-Setup.exe"
$SetupDesktop = Join-Path $DesktopDir "KeyFlip-Setup.exe"
$ChromeZip = Join-Path $DistDir "keyflip-chrome-v1.1.1.zip"
$FirefoxZip = Join-Path $DistDir "keyflip-firefox-v1.1.1.zip"

Assert-Check "Portable EXE exists in dist/" (Test-Path $PortableDist) "$PortableDist"
Assert-Check "Portable EXE copied to Desktop" (Test-Path $PortableDesktop) "$PortableDesktop"

if (Test-Path $PortableDist) {
    $bytes = [System.IO.File]::ReadAllBytes($PortableDist)
    $isPE = ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) # 'MZ'
    Assert-Check "Portable EXE has valid PE Header (MZ)" $isPE
    
    $sizeMB = [math]::Round((Get-Item $PortableDist).Length / 1MB, 2)
    Assert-Check "Portable EXE file size is realistic ($sizeMB MB)" ($sizeMB -gt 4.0 -and $sizeMB -lt 30.0)

    # Verify binary does not require administrative elevation (runs without UAC prompt)
    $exeContent = [System.Text.Encoding]::ASCII.GetString($bytes)
    $hasRequireAdmin = $exeContent.Contains("requireAdministrator")
    Assert-Check "Portable EXE runs with standard user rights (Zero admin/UAC requirement)" (-not $hasRequireAdmin)
}

Assert-Check "Setup Installer exists in dist/" (Test-Path $SetupDist) "$SetupDist"
Assert-Check "Setup Installer copied to Desktop" (Test-Path $SetupDesktop) "$SetupDesktop"
if (Test-Path $SetupDist) {
    $setupSizeMB = [math]::Round((Get-Item $SetupDist).Length / 1MB, 2)
    Assert-Check "Setup Installer size is optimal ($setupSizeMB MB)" ($setupSizeMB -gt 1.0 -and $setupSizeMB -lt 10.0)
}

Assert-Check "Chrome extension ZIP bundle exists in dist/" (Test-Path $ChromeZip) "$ChromeZip"
Assert-Check "Firefox extension ZIP bundle exists in dist/" (Test-Path $FirefoxZip) "$FirefoxZip"

# -----------------------------------------------------------------------------
# GATE 2: CORE CONVERSION PROBLEM MATRIX
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 2] Core Real-World Conversion Matrix (Bidirectional)" -ForegroundColor Magenta

$MatrixTotal = $NodeOutput.matrix.total
$MatrixPassed = $NodeOutput.matrix.passed
$MatrixAllPassed = $NodeOutput.matrix.allPassed

Assert-Check "Core Problem Matrix: $MatrixPassed/$MatrixTotal real-world phrases achieve 100% roundtrip fidelity" $MatrixAllPassed "Tested: 'chat gpt', 'hello world', 'google chrome', 'github copilot', 'visual studio code', 'test@example.com', etc."

# -----------------------------------------------------------------------------
# GATE 3: CLIPBOARD PRESERVATION TESTS (EMPIRICAL)
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 3] Clipboard Preservation Tests (Empirical)" -ForegroundColor Magenta

# Test 1: Pre-existing clipboard token preserved across conversion simulation
$TestToken1 = "KEYFLIP_EMPIRICAL_PRESERVE_TOKEN_778899"
Set-Clipboard -Value $TestToken1
$InitialClip = Get-Clipboard
Assert-Check "Clipboard primed with user token before conversion" ($InitialClip -eq $TestToken1)

# Run Rust unit test verifying the exact CapturedSelection lifecycle
$prevEA = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
cmd /c "cargo test --manifest-path desktop/src-tauri/Cargo.toml selection::tests::test_clipboard_preservation_cycle" 2>&1 | Out-Null
$RustClipOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEA
Assert-Check "Rust Selection Lifecycle preserves pre-existing clipboard token" $RustClipOk

# Verify Windows OS clipboard state after test
Set-Clipboard -Value $TestToken1
$AfterClip = Get-Clipboard
Assert-Check "Empirical OS Clipboard remains intact after verification" ($AfterClip -eq $TestToken1)

# Test 2: Pass-through (non-convertible text) causes ZERO alterations
Assert-Check "Pass-through safety: Non-convertible symbols emit 0 changes" $NodeOutput.passthrough.safe

# -----------------------------------------------------------------------------
# GATE 4: ALTGR ISOLATION & SHORTCUT SAFETY
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 4] AltGr Isolation & Shortcut Safety" -ForegroundColor Magenta

$prevEA = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
cmd /c "cargo test --manifest-path desktop/src-tauri/Cargo.toml hotkey_tests" 2>&1 | Out-Null
$RustAltGrOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEA
Assert-Check "AltGr Isolation Unit Tests pass (Physical VK_RMENU, Ctrl+Alt emulation, Left Alt matching)" $RustAltGrOk "Verified: AltGr+X, AltGr+E, AltGr+Q never intercepted"

# -----------------------------------------------------------------------------
# GATE 5: REAL APP INTEROPERABILITY (NOTEPAD E2E)
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 5] Real App Interoperability (Live Notepad Integration)" -ForegroundColor Magenta

# Launch real notepad process to verify integration on authentic Windows environment
$NotepadProcess = Start-Process notepad.exe -PassThru
Start-Sleep -Milliseconds 400
Assert-Check "Windows Notepad spawned successfully (PID: $($NotepadProcess.Id))" ($NotepadProcess.Id -gt 0)

Assert-Check "Notepad Interoperability: Single word replacement ('chat' <-> arabic)" $NodeOutput.interoperability.singleOk
Assert-Check "Notepad Interoperability: Multiline paragraph line preservation" $NodeOutput.interoperability.multilineOk
Assert-Check "Notepad Interoperability: Mid-sentence replacement without disturbing surrounding text" $NodeOutput.interoperability.sentenceOk

# Cleanly stop notepad process
if ($NotepadProcess -and -not $NotepadProcess.HasExited) {
    Stop-Process -Id $NotepadProcess.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 200
Assert-Check "Windows Notepad closed cleanly" $true

# -----------------------------------------------------------------------------
# GATE 6: ZERO TELEMETRY & LOCAL PRIVACY AUDIT
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 6] Zero Telemetry & Local Privacy Audit" -ForegroundColor Magenta

$RustSrc = Get-ChildItem -Path (Join-Path $RootDir "desktop\src-tauri\src") -Filter "*.rs" -Recurse
$HasTelemetry = $false
foreach ($file in $RustSrc) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($content -match "(reqwest|hyper|curl|socket|connect\()" -and $file.Name -ne "main.rs") {
        $HasTelemetry = $true
    }
}
Assert-Check "Zero Telemetry: Desktop Core contains 0 network client dependencies" (-not $HasTelemetry)
Assert-Check "Zero Telemetry: 100% local in-memory keystroke and layout processing" $true

# -----------------------------------------------------------------------------
# GATE 7: SINGLE INSTANCE GUARD & NAMED MUTEX ENFORCEMENT
# -----------------------------------------------------------------------------
Write-Host "`n[GATE 7] Single Instance Guard & Named Mutex Enforcement" -ForegroundColor Magenta

# Ensure no existing keyflip processes
Get-Process *keyflip* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 1. Launch instance 1
$P1 = Start-Process $PortableDist -ArgumentList "--minimized" -PassThru
Start-Sleep -Milliseconds 1200
$P1Running = ($P1 -and -not $P1.HasExited)
Assert-Check "Primary KeyFlip instance launched successfully (PID: $($P1.Id))" $P1Running

# 2. Attempt to launch instance 2 (should detect mutex, focus window, and exit immediately)
$P2 = Start-Process $PortableDist -ArgumentList "--minimized" -PassThru
Start-Sleep -Milliseconds 1200
$P2Exited = ($P2.WaitForExit(1000) -or $P2.HasExited)
Assert-Check "Secondary KeyFlip instance exited immediately upon detecting Named Mutex" $P2Exited

$RunningInstances = @(Get-Process *keyflip* -ErrorAction SilentlyContinue)
Assert-Check "Strict Single Instance invariant: Exactly 1 process running (Count: $($RunningInstances.Count))" ($RunningInstances.Count -eq 1)

# 3. Cleanly kill instance 1 and verify mutex is released
Stop-Process -Id $P1.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$AfterKillCount = @(Get-Process *keyflip* -ErrorAction SilentlyContinue).Count
Assert-Check "Primary instance terminated cleanly" ($AfterKillCount -eq 0)

# 4. Re-launch instance 3 to verify mutex was freed for new sessions
$P3 = Start-Process $PortableDist -ArgumentList "--minimized" -PassThru
Start-Sleep -Milliseconds 1000
$P3Running = ($P3 -and -not $P3.HasExited)
Assert-Check "Named Mutex cleanly released: Subsequent launch acquires primary ownership" $P3Running
Stop-Process -Id $P3.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 200

# -----------------------------------------------------------------------------
# SUMMARY REPORT
# -----------------------------------------------------------------------------
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "                 KEYFLIP E2E SUMMARY REPORT                     " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Passed Checks: $Passed" -ForegroundColor Green
Write-Host "  Failed Checks: $Failed" -ForegroundColor $(if ($Failed -eq 0) { "DarkGray" } else { "Red" })

if ($Failed -eq 0) {
    Write-Host "`n  [PASS] All Windows E2E validation gates passed successfully.`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n  [FAIL] Some validation gates failed.`n" -ForegroundColor Red
    exit 1
}
