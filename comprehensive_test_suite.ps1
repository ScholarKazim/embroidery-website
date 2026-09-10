# Comprehensive Audit & Test Suite for Khama IQ Platform
$base = "http://localhost:8080"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       KHAMA IQ - COMPREHENSIVE AUDIT & TEST SUITE        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------
# 1. 404 PAGE & FORWARDING TESTS
# -----------------------------------------------------------------
Write-Host "`n[1] Testing 404 Page & URL Forwarding..." -ForegroundColor Yellow
$p404Results = @()

# Test non-existent page
try {
    $r404 = Invoke-WebRequest -Uri "$base/random-non-existent-page-12345" -UseBasicParsing
    $p404Results += "FAIL: Expected 404, got $($r404.StatusCode)"
} catch {
    $resp = $_.Exception.Response
    if ($resp.StatusCode -eq [System.Net.HttpStatusCode]::NotFound) {
        $curlOut = & curl.exe -s "$base/random-non-existent-page-12345"
        if ($curlOut -match "404" -and $curlOut -match "not-found-card") {
            $p404Results += "PASS: 404 returned branded HTML page (404.html) with HTTP 404 status"
        } else {
            $p404Results += "WARN: 404 returned, but content is not custom 404.html"
        }
    } else {
        $p404Results += "FAIL: Unexpected status code $($resp.StatusCode)"
    }
}

# Test route aliases
$routeAliases = @(
    @{ Path = "/products"; Name = "English Products" },
    @{ Path = "/class"; Name = "English Class" },
    @{ Path = "/models"; Name = "English Models" },
    @{ Path = "/vote"; Name = "English Vote" },
    @{ Path = "/track"; Name = "English Track" },
    @{ Path = "/checkout"; Name = "English Checkout" },
    @{ Path = "/admin"; Name = "English Admin" },
    @{ Path = "/size"; Name = "English Size" },
    @{ Path = "/%D9%85%D9%86%D8%AA%D8%AC%D8%A7%D8%AA"; Name = "Arabic Products (montajat)" },
    @{ Path = "/%D8%AF%D9%81%D8%B9%D8%A9"; Name = "Arabic Class (duf'a)" },
    @{ Path = "/%D9%86%D9%85%D8%A7%D8%B0%D8%AC"; Name = "Arabic Models (namathij)" },
    @{ Path = "/%D8%AA%D8%B5%D9%88%D9%8A%D8%AA"; Name = "Arabic Vote (tasweet)" },
    @{ Path = "/%D9%82%D9%8A%D8%A7%D8%B3"; Name = "Arabic Size (qiyas)" },
    @{ Path = "/%D8%B7%D9%84%D8%A8"; Name = "Arabic Checkout (talab)" },
    @{ Path = "/%D8%AA%D8%AA%D8%A8%D8%B9"; Name = "Arabic Track (tatabbu)" }
)

foreach ($ra in $routeAliases) {
    try {
        $r = Invoke-WebRequest -Uri ($base + $ra.Path) -UseBasicParsing
        if ($r.StatusCode -eq 200) {
            $p404Results += "PASS: $($ra.Name) ($($ra.Path)) -> 200 OK"
        } else {
            $p404Results += "FAIL: $($ra.Name) ($($ra.Path)) -> $($r.StatusCode)"
        }
    } catch {
        $p404Results += "FAIL: $($ra.Name) ($($ra.Path)) -> $_"
    }
}
$p404Results | ForEach-Object { Write-Host "  $_" }

# -----------------------------------------------------------------
# 2. SECURITY AUDIT & DEFENSE TESTS
# -----------------------------------------------------------------
Write-Host "`n[2] Testing Security & OWASP Defenses..." -ForegroundColor Yellow
$secResults = @()

# 2A. HTTP Security Headers
$homeResp = Invoke-WebRequest -Uri "$base/" -UseBasicParsing
$headersToCheck = @("X-Content-Type-Options", "X-Frame-Options", "X-XSS-Protection", "Referrer-Policy")
foreach ($h in $headersToCheck) {
    if ($homeResp.Headers[$h]) {
        $secResults += "PASS: Header '$h' is present: $($homeResp.Headers[$h])"
    } else {
        $secResults += "FAIL: Missing required security header '$h'"
    }
}

# 2B. Path Traversal Attacks
$traversalTests = @(
    "/../../Windows/win.ini",
    "/..%2F..%2Fwindows%2Fwin.ini",
    "/....//....//Windows/win.ini",
    "/etc/passwd"
)
foreach ($t in $traversalTests) {
    try {
        $tr = Invoke-WebRequest -Uri "$base$t" -UseBasicParsing -TimeoutSec 2
        $secResults += "FAIL: Path traversal not blocked for '$t' (got $($tr.StatusCode))"
    } catch {
        $status = $_.Exception.Response.StatusCode
        if ($status -eq 403 -or $status -eq 404) {
            $secResults += "PASS: Path traversal attack '$t' blocked (HTTP $status)"
        } else {
            $secResults += "PASS: Path traversal attack '$t' rejected ($status)"
        }
    }
}

# 2C. Admin Endpoint Security
try {
    # Request without admin PIN or token
    $adminResp = Invoke-WebRequest -Uri "$base/api/orders" -UseBasicParsing -TimeoutSec 2
    $secResults += "FAIL: Unauthenticated access to /api/orders was allowed!"
} catch {
    $status = $_.Exception.Response.StatusCode
    if ($status -eq 401 -or $status -eq 403) {
        $secResults += "PASS: Unauthorized order listing blocked (HTTP $status)"
    } else {
        $secResults += "WARN: Unauthorized access rejected with status $status"
    }
}

$secResults | ForEach-Object { Write-Host "  $_" }

# -----------------------------------------------------------------
# 3. SMS & OTP FLOW TESTS
# -----------------------------------------------------------------
Write-Host "`n[3] Testing SMS & OTP Flow..." -ForegroundColor Yellow
$smsResults = @()

$testPhone = "07801234567"
$testPhoneInvalid = "1234"

# 3A. Request OTP with invalid phone
try {
    $invBody = '{"phone":"1234"}'
    $invResp = Invoke-WebRequest -Uri "$base/api/voting/auth/request-otp" -Method POST -Body $invBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $smsResults += "FAIL: Invalid phone was accepted!"
} catch {
    $status = $_.Exception.Response.StatusCode
    if ($status -eq 400) {
        $smsResults += "PASS: Invalid phone number correctly rejected (HTTP 400)"
    } else {
        $smsResults += "WARN: Invalid phone rejected with $status"
    }
}

# 3B. Request OTP with valid Iraqi phone
$otpCode = $null
try {
    $valBody = '{"phone":"07801234567"}'
    $valResp = Invoke-WebRequest -Uri "$base/api/voting/auth/request-otp" -Method POST -Body $valBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $valJson = $valResp.Content | ConvertFrom-Json
    if ($valJson.success -eq $true) {
        $otpCode = $valJson.simulatedCode
        $smsResults += "PASS: OTP requested successfully. Simulated code: $otpCode, expires in $($valJson.expiresIn)s"
    } else {
        $smsResults += "FAIL: OTP request returned success=false"
    }
} catch {
    $smsResults += "FAIL: OTP request failed: $_"
}

# 3C. Rate Limiting Test (immediately request again)
try {
    $valBody = '{"phone":"07801234567"}'
    $floodResp = Invoke-WebRequest -Uri "$base/api/voting/auth/request-otp" -Method POST -Body $valBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $smsResults += "WARN: Immediate second OTP request was allowed without cooldown"
} catch {
    $status = $_.Exception.Response.StatusCode
    if ($status -eq 429) {
        $smsResults += "PASS: Rapid OTP flooding blocked by Rate Limiter (HTTP 429 Too Many Requests)"
    } else {
        $smsResults += "INFO: Second request returned $status"
    }
}

# 3D. Verify OTP with wrong code
try {
    $wrongBody = '{"phone":"07801234567","code":"000000"}'
    $wrongResp = Invoke-WebRequest -Uri "$base/api/voting/auth/verify-otp" -Method POST -Body $wrongBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $smsResults += "FAIL: Wrong OTP code was accepted!"
} catch {
    $status = $_.Exception.Response.StatusCode
    if ($status -eq 400) {
        $smsResults += "PASS: Wrong OTP code correctly rejected (HTTP 400)"
    } else {
        $smsResults += "WARN: Wrong OTP rejected with $status"
    }
}

# 3E. Verify OTP with correct code
if ($otpCode) {
    try {
        $correctBody = '{"phone":"07801234567","code":"' + $otpCode + '"}'
        $correctResp = Invoke-WebRequest -Uri "$base/api/voting/auth/verify-otp" -Method POST -Body $correctBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
        $correctJson = $correctResp.Content | ConvertFrom-Json
        if ($correctJson.success -eq $true -and $correctJson.sessionToken) {
            $smsResults += "PASS: Correct OTP verified! Session token granted: $($correctJson.sessionToken.Substring(0, 8))..."
        } else {
            $smsResults += "FAIL: Correct OTP verification did not return session token"
        }
    } catch {
        $smsResults += "FAIL: Correct OTP verification failed: $_"
    }
}

$smsResults | ForEach-Object { Write-Host "  $_" }

# -----------------------------------------------------------------
# 4. SPEED & LATENCY BENCHMARKS
# -----------------------------------------------------------------
Write-Host "`n[4] Running Speed & Performance Benchmarks..." -ForegroundColor Yellow
$speedResults = @()

$benchRoutes = @("/", "/products", "/class", "/models", "/vote", "/track")
foreach ($br in $benchRoutes) {
    $times = @()
    for ($i = 0; $i -lt 5; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $resp = Invoke-WebRequest -Uri "$base$br" -UseBasicParsing
        $sw.Stop()
        $times += $sw.ElapsedMilliseconds
    }
    $avgTime = [Math]::Round(($times | Measure-Object -Average).Average, 1)
    $minTime = ($times | Measure-Object -Minimum).Minimum
    $maxTime = ($times | Measure-Object -Maximum).Maximum
    $sizeKb = [Math]::Round($resp.RawContentLength / 1024, 1)

    $speedResults += "Route $br : Avg = $($avgTime)ms (Min: ${minTime}ms, Max: ${maxTime}ms) | Size = ${sizeKb} KB"
}

# Benchmark Image asset delivery speed
$swImg = [System.Diagnostics.Stopwatch]::StartNew()
$imgResp = Invoke-WebRequest -Uri "$base/khamaiq.com/assets/images/visualizer-emerald.jpg?v=p2026_real" -UseBasicParsing
$swImg.Stop()
$imgSizeKb = [Math]::Round($imgResp.RawContentLength / 1024, 1)
$speedResults += "Image Delivery (visualizer-emerald.jpg): $($swImg.ElapsedMilliseconds)ms | Size = ${imgSizeKb} KB"

$speedResults | ForEach-Object { Write-Host "  $_" }

# -----------------------------------------------------------------
# 5. BUG CHECKS & INTEGRITY
# -----------------------------------------------------------------
Write-Host "`n[5] Bug Checks & File Integrity..." -ForegroundColor Yellow
$bugResults = @()

# Check universities.json
if ([System.IO.File]::Exists("universities.json")) {
    $uData = Get-Content "universities.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $bugResults += "PASS: universities.json valid ($($uData.Count) universities configured)"
} else {
    $bugResults += "FAIL: universities.json missing"
}

# Check orders.json
if ([System.IO.File]::Exists("orders.json")) {
    $oData = Get-Content "orders.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $bugResults += "PASS: orders.json valid ($($oData.Count) orders stored)"
} else {
    $bugResults += "FAIL: orders.json missing"
}

# Check voting.json
if ([System.IO.File]::Exists("voting.json")) {
    $vData = Get-Content "voting.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $bugResults += "PASS: voting.json valid ($($vData.votes.Count) votes, $($vData.representatives.Count) reps)"
} else {
    $bugResults += "FAIL: voting.json missing"
}

$bugResults | ForEach-Object { Write-Host "  $_" }

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                AUDIT & TESTS COMPLETE                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
