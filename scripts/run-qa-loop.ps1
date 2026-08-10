# ============================================================
# Flowstack QA Closed-Loop Runner
# วิธีใช้: pwsh scripts/run-qa-loop.ps1
# ============================================================
# จะรันทุก test file ทีละไฟล์ และแสดงผลสรุปตอนท้าย
# ============================================================

$ErrorActionPreference = "Continue"

$UnitTests = @(
  "src/lib/__tests__/flowstack-integration.test.ts",
  "src/lib/__tests__/kpi.test.ts",
  "src/lib/__tests__/scoring.test.ts"
)

$E2ETests = @(
  "e2e/auth.spec.ts",
  "e2e/projects.spec.ts",
  "e2e/sales.spec.ts",
  "e2e/support.spec.ts",
  "e2e/workflow-bpm.spec.ts"
)

$Results = @()

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " FLOWSTACK QA AUTOMATION — CLOSED LOOP RUN" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# ── Unit Tests ────────────────────────────────────────────────
Write-Host "[1/2] UNIT TESTS (Vitest)" -ForegroundColor Yellow

foreach ($file in $UnitTests) {
  if (-not (Test-Path $file)) {
    Write-Host "  SKIP  $file (ไม่พบไฟล์)" -ForegroundColor Gray
    continue
  }

  Write-Host "  Running: $file" -ForegroundColor White
  $output = pnpm test $file 2>&1 | Out-String
  $passed = [regex]::Match($output, '(\d+) passed').Groups[1].Value
  $failed = [regex]::Match($output, '(\d+) failed').Groups[1].Value
  $skipped = [regex]::Match($output, '(\d+) skipped').Groups[1].Value
  $ok = $output -match "passed" -and ($failed -eq "" -or $failed -eq "0")

  $Results += [PSCustomObject]@{
    File    = $file
    Type    = "Unit"
    Passed  = if ($passed) { $passed } else { "?" }
    Failed  = if ($failed) { $failed } else { "0" }
    Skipped = if ($skipped) { $skipped } else { "0" }
    Status  = if ($ok) { "✅ PASS" } else { "❌ FAIL" }
  }

  if ($ok) {
    Write-Host "    ✅ PASS ($passed tests)" -ForegroundColor Green
  } else {
    Write-Host "    ❌ FAIL" -ForegroundColor Red
    Write-Host $output -ForegroundColor DarkRed
  }
}

# ── E2E Tests ─────────────────────────────────────────────────
Write-Host "`n[2/2] E2E TESTS (Playwright)" -ForegroundColor Yellow
Write-Host "  NOTE: ต้องมี dev server และ XAMPP รันอยู่ก่อน" -ForegroundColor Gray

$devServerRunning = $false
try {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/flowstack" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
  $devServerRunning = $true
} catch {
  Write-Host "  ⚠️  ไม่สามารถเชื่อมต่อ http://localhost:8080/flowstack — ข้าม E2E tests" -ForegroundColor DarkYellow
}

if ($devServerRunning) {
  foreach ($file in $E2ETests) {
    if (-not (Test-Path $file)) {
      Write-Host "  SKIP  $file (ไม่พบไฟล์)" -ForegroundColor Gray
      continue
    }

    Write-Host "  Running: $file" -ForegroundColor White
    $output = pnpm playwright test $file --reporter=list 2>&1 | Out-String
    $passed  = [regex]::Match($output, '(\d+) passed').Groups[1].Value
    $failed  = [regex]::Match($output, '(\d+) failed').Groups[1].Value
    $skipped = [regex]::Match($output, '(\d+) skipped').Groups[1].Value
    $ok      = $output -match "passed" -and ($failed -eq "" -or $failed -eq "0")

    $Results += [PSCustomObject]@{
      File    = $file
      Type    = "E2E"
      Passed  = if ($passed) { $passed } else { "0" }
      Failed  = if ($failed) { $failed } else { "0" }
      Skipped = if ($skipped) { $skipped } else { "0" }
      Status  = if ($ok) { "✅ PASS" } else { "❌ FAIL" }
    }

    if ($ok) {
      Write-Host "    ✅ PASS ($passed tests)" -ForegroundColor Green
    } else {
      Write-Host "    ❌ FAIL ($failed failed)" -ForegroundColor Red
      # แสดง error ที่เกี่ยวข้อง
      $errorLines = ($output -split "`n") | Where-Object { $_ -match "Error|expect|●|FAILED" } | Select-Object -First 10
      $errorLines | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkRed }
    }
  }
} else {
  Write-Host "  → รัน unit tests เท่านั้น" -ForegroundColor Gray
}

# ── Summary Table ─────────────────────────────────────────────
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " สรุปผลการทดสอบ" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$Results | Format-Table -AutoSize -Property Status, Type, File, Passed, Failed, Skipped

$totalPass = ($Results | Where-Object { $_.Status -eq "✅ PASS" }).Count
$totalFail = ($Results | Where-Object { $_.Status -eq "❌ FAIL" }).Count

Write-Host "ผ่าน: $totalPass ไฟล์  |  ล้มเหลว: $totalFail ไฟล์" -ForegroundColor $(if ($totalFail -eq 0) { "Green" } else { "Red" })

if ($totalFail -gt 0) {
  Write-Host "`n⚠️  มี test ล้มเหลว — ดู log ด้านบนเพื่อแก้ไข" -ForegroundColor DarkYellow
  Write-Host "  วิธีใช้ Claude Code แก้ไข:"
  Write-Host "  1. คัดลอก error message จาก log ด้านบน"
  Write-Host "  2. วางใน Claude Code: 'แก้ไข test ที่ล้มเหลว: <error>'"
  Write-Host "  3. Claude Code จะอ่านไฟล์ → แก้ไข → รันใหม่อัตโนมัติ"
  exit 1
} else {
  Write-Host "`n✅ ทุก test ผ่าน!" -ForegroundColor Green
  exit 0
}
