$listener = New-Object System.Net.HttpListener
$port = 8080
try {
    $listener.Prefixes.Add("http://localhost:8080/")
    $listener.Prefixes.Add("http://127.0.0.1:8080/")
    $listener.Prefixes.Add("http://localhost:8085/")
    $listener.Prefixes.Add("http://127.0.0.1:8085/")
    $listener.Start()
} catch {
    $listener = New-Object System.Net.HttpListener
    try {
        $listener.Prefixes.Add("http://localhost:8080/")
        $listener.Prefixes.Add("http://127.0.0.1:8080/")
        $listener.Start()
        $port = 8080
    } catch {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:8085/")
        $listener.Prefixes.Add("http://127.0.0.1:8085/")
        $listener.Start()
        $port = 8085
    }
}

$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".htm"   = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".webp"  = "image/webp"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff2" = "font/woff2"
    ".woff"  = "font/woff"
    ".ttf"   = "font/ttf"
}

$rootDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$canonicalRoot = [System.IO.Path]::GetFullPath($rootDir)
$ordersDbPath  = Join-Path $rootDir "orders.json"
$votingDbPath  = Join-Path $rootDir "voting.json"
$batchesDbPath = Join-Path $rootDir "batches.json"
$unisDbPath    = Join-Path $rootDir "universities.json"
$ADMIN_TOKEN   = "khama_admin_2026"
$utf8NoBom     = New-Object System.Text.UTF8Encoding($false)

# Initialize orders and voting database files if not exists
if (-not [System.IO.File]::Exists($ordersDbPath)) {
    [System.IO.File]::WriteAllText($ordersDbPath, "[]", $utf8NoBom)
}
if (-not [System.IO.File]::Exists($votingDbPath)) {
    [System.IO.File]::WriteAllText($votingDbPath, '{"votes":[],"otps":[],"representatives":[]}', $utf8NoBom)
}
if (-not [System.IO.File]::Exists($batchesDbPath)) {
    [System.IO.File]::WriteAllText($batchesDbPath, "[]", $utf8NoBom)
}

# Mutexes for thread-safe atomic database read/writes
$dbMutex     = New-Object System.Threading.Mutex($false, "Global\KhamaOrdersDbMutex")
$votingMutex = New-Object System.Threading.Mutex($false, "Global\KhamaVotingDbMutex")
$batchMutex  = New-Object System.Threading.Mutex($false, "Global\KhamaBatchDbMutex")

Write-Host "========================================="
Write-Host "  Ibra Wa Kheit Hardened Web & DB Server"
Write-Host "  Store:  http://localhost:$port/"
Write-Host "  Admin:  http://localhost:$port/admin"
Write-Host "  Track:  http://localhost:$port/track"
Write-Host "========================================="

function Get-RequestBody($req) {
    try {
        if ($req.ContentLength64 -le 0) { return $null }
        $ms = New-Object System.IO.MemoryStream
        $buf = New-Object byte[] 4096
        $total = 0
        while ($total -lt $req.ContentLength64) {
            $toRead = [Math]::Min(4096, [int]($req.ContentLength64 - $total))
            $readCount = $req.InputStream.Read($buf, 0, $toRead)
            if ($readCount -le 0) { break }
            $ms.Write($buf, 0, $readCount)
            $total += $readCount
        }
        $txt = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        if ([string]::IsNullOrWhiteSpace($txt)) { return $null }
        return ConvertFrom-Json $txt
    } catch {
        return $null
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = $request.Url.AbsolutePath.Trim('/')
        $relPath = [System.Uri]::UnescapeDataString($rawPath)

        # -----------------------------------------------------------------
        # HTTP SECURITY HEADERS (OWASP Top 10 Hardening)
        # -----------------------------------------------------------------
        $response.AddHeader("X-Content-Type-Options", "nosniff")
        $response.AddHeader("X-Frame-Options", "SAMEORIGIN")
        $response.AddHeader("X-XSS-Protection", "1; mode=block")
        $response.AddHeader("Referrer-Policy", "strict-origin-when-cross-origin")
        $response.AddHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()")

        # CORS Headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")

        # Handle CORS preflight
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.OutputStream.Close()
            continue
        }

        # -----------------------------------------------------------------
        # API ROUTE: /api/universities
        # -----------------------------------------------------------------
        if ($relPath -eq "api/universities" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Cache-Control", "public, max-age=3600")
            $uBytes = if ([System.IO.File]::Exists($unisDbPath)) { [System.IO.File]::ReadAllBytes($unisDbPath) } else { [System.Text.Encoding]::UTF8.GetBytes("[]") }
            $response.StatusCode = 200
            $response.ContentLength64 = $uBytes.Length
            if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($uBytes, 0, $uBytes.Length) }
            $response.OutputStream.Close()
            continue
        }

        # -----------------------------------------------------------------
        # API ROUTE: /api/voting/*
        # -----------------------------------------------------------------
        if ($relPath.StartsWith("api/voting") -or $relPath -eq "api/voting") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Cache-Control", "no-store, no-cache, must-revalidate")
            $subPath = if ($relPath.Length -gt 10) { $relPath.Substring(10).Trim('/') } else { "" }

            # 1. GET /api/voting/universities
            if ($subPath -eq "universities" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
                $uBytes = if ([System.IO.File]::Exists($unisDbPath)) { [System.IO.File]::ReadAllBytes($unisDbPath) } else { [System.Text.Encoding]::UTF8.GetBytes("[]") }
                $response.StatusCode = 200
                $response.ContentLength64 = $uBytes.Length
                if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($uBytes, 0, $uBytes.Length) }
                $response.OutputStream.Close()
                continue
            }

            # Helper to load voting DB safely
            function Get-VotingDb {
                [void]$votingMutex.WaitOne(5000)
                try {
                    $raw = [System.IO.File]::ReadAllText($votingDbPath, [System.Text.Encoding]::UTF8)
                    if ([string]::IsNullOrWhiteSpace($raw)) {
                        return [PSCustomObject]@{ votes = @(); otps = @(); representatives = @() }
                    }
                    return ConvertFrom-Json $raw
                } finally {
                    $votingMutex.ReleaseMutex()
                }
            }

            # Helper to save voting DB safely
            function Save-VotingDb($dbObj) {
                [void]$votingMutex.WaitOne(5000)
                try {
                    $jsonStr = ConvertTo-Json $dbObj -Depth 10
                    [System.IO.File]::WriteAllText($votingDbPath, $jsonStr, $utf8NoBom)
                } finally {
                    $votingMutex.ReleaseMutex()
                }
            }

            # 1B. GET /api/voting/all (All Votes)
            if ($subPath -eq "all" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
                $db = Get-VotingDb
                $resObj = @{ success = $true; votes = $db.votes }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                $response.StatusCode = 200
                $response.ContentLength64 = $outBytes.Length
                if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($outBytes, 0, $outBytes.Length) }
                $response.OutputStream.Close()
                continue
            }

            # 2. POST /api/voting/auth/request-otp
            if ($subPath -eq "auth/request-otp" -and $request.HttpMethod -eq "POST") {
                $body = Get-RequestBody $request
                $phone = if ($body -and $body.phone) { ($body.phone -replace '[^\d+]', '').Trim() } else { $null }
                if (-not $phone -or $phone.Length -lt 10) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"يرجى إدخال رقم هاتف عراقي صالح"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $db = Get-VotingDb
                $existingOtp = $db.otps | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
                if ($existingOtp -and $existingOtp.lastRequestedAt) {
                    $timeSinceLast = (Get-Date) - [DateTime]::Parse($existingOtp.lastRequestedAt)
                    if ($timeSinceLast.TotalSeconds -lt 45) {
                        $remaining = [Math]::Ceiling(45 - $timeSinceLast.TotalSeconds)
                        $response.StatusCode = 429
                        $err = [System.Text.Encoding]::UTF8.GetBytes(('{"success":false,"error":"يرجى الانتظار ' + $remaining + ' ثانية قبل طلب رمز جديد"}'))
                        $response.OutputStream.Write($err, 0, $err.Length)
                        $response.OutputStream.Close()
                        continue
                    }
                }

                $code = (Get-Random -Minimum 100000 -Maximum 999999).ToString()
                $exp = (Get-Date).AddMinutes(5).ToString("o")
                $nowStr = (Get-Date).ToString("o")

                $otps = @($db.otps | Where-Object { $_.phone -ne $phone })
                $newOtp = [PSCustomObject]@{
                    phone = $phone
                    code = $code
                    expiresAt = $exp
                    lastRequestedAt = $nowStr
                    attempts = 0
                }
                $db.otps = @($otps) + @($newOtp)
                Save-VotingDb $db

                $resObj = @{
                    success = $true
                    message = "تم إرسال رمز التحقق إلى رقم هاتفك بنجاح"
                    simulatedCode = $code
                    expiresIn = 300
                }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj))
                $response.StatusCode = 200
                $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 3. POST /api/voting/auth/verify-otp
            if ($subPath -eq "auth/verify-otp" -and $request.HttpMethod -eq "POST") {
                $body = Get-RequestBody $request
                $phone = if ($body -and $body.phone) { ($body.phone -replace '[^\d+]', '').Trim() } else { $null }
                $code = if ($body -and $body.code) { $body.code.Trim() } else { $null }

                $db = Get-VotingDb
                $otpEntry = $db.otps | Where-Object { $_.phone -eq $phone } | Select-Object -First 1

                if (-not $otpEntry) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"لم يتم العثور على رمز تحقق لهذا الرقم أو انتهت صلاحيته"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                if ([DateTime]::UtcNow -gt [DateTime]::Parse($otpEntry.expiresAt).ToUniversalTime()) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"انتهت صلاحية رمز التحقق (5 دقائق)، يرجى طلب رمز جديد"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                if ($otpEntry.attempts -ge 3) {
                    $response.StatusCode = 429
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"تم تجاوز الحد الأقصى للمحاولات (3 محاولات)، يرجى طلب رمز جديد"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                if ($otpEntry.code -ne $code) {
                    $otpEntry.attempts++
                    Save-VotingDb $db
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"رمز التحقق غير صحيح، حاول مرة أخرى"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Verified: clear OTP, register representative
                $db.otps = @($db.otps | Where-Object { $_.phone -ne $phone })
                $rep = $db.representatives | Where-Object { $_.phone -eq $phone } | Select-Object -First 1
                if (-not $rep) {
                    $rep = [PSCustomObject]@{
                        id = "rep_" + (Get-Random -Minimum 100000 -Maximum 999999)
                        phone = $phone
                        verifiedAt = (Get-Date).ToString("o")
                    }
                    $db.representatives = @($db.representatives) + @($rep)
                }
                Save-VotingDb $db

                $token = "rep_token_" + (-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object {[char]$_}))
                $resObj = @{ success = $true; token = $token; sessionToken = $token; rep = $rep }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj))
                $response.StatusCode = 200
                $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 4. POST /api/voting/votes (Create Vote)
            if ($subPath -eq "votes" -and $request.HttpMethod -eq "POST") {
                $body = Get-RequestBody $request
                if (-not $body.colors -or $body.colors.Count -lt 2) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"يرجى اختيار لونين على الأقل للتصويت"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $durationDays = if ($body.durationDays -ge 3 -and $body.durationDays -le 7) { [int]$body.durationDays } else { 5 }
                $token = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object {[char]$_})
                $createdAt = (Get-Date).ToString("o")
                $endsAt = (Get-Date).AddDays($durationDays).ToString("o")

                $newVote = [PSCustomObject]@{
                    id = "VOTE-" + (Get-Random -Minimum 1000 -Maximum 9999)
                    shareToken = $token
                    repPhone = $body.repPhone
                    universityId = $body.universityId
                    universityName = $body.universityName
                    collegeId = $body.collegeId
                    collegeName = $body.collegeName
                    fixedEntityId = $body.fixedEntityId
                    durationDays = $durationDays
                    status = "active"
                    createdAt = $createdAt
                    endsAt = $endsAt
                    colors = $body.colors
                    choices = @()
                }

                $db = Get-VotingDb
                $db.votes = @($db.votes) + @($newVote)
                Save-VotingDb $db

                $resObj = @{ success = $true; vote = $newVote; shareUrl = "/vote?token=" + $token }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                $response.StatusCode = 201
                $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 5. /api/voting/votes/{token} (GET, POST choice, POST end)
            if ($subPath.StartsWith("votes/")) {
                $voteParts = $subPath.Substring(6).Split('/')
                $vToken = $voteParts[0]
                $action = if ($voteParts.Length -ge 2) { $voteParts[1] } else { $null }

                $db = Get-VotingDb
                $voteObj = $db.votes | Where-Object { $_.shareToken -eq $vToken -or $_.id -eq $vToken } | Select-Object -First 1

                if (-not $voteObj) {
                    $response.StatusCode = 404
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"لم يتم العثور على هذا التصويت"}')
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Auto-check expiration
                if ($voteObj.status -eq "active" -and ([DateTime]::UtcNow -gt [DateTime]::Parse($voteObj.endsAt).ToUniversalTime())) {
                    $voteObj.status = "ended"
                    Save-VotingDb $db
                }

                # 5A. End Vote Manually
                if ($action -eq "end" -and $request.HttpMethod -eq "POST") {
                    $voteObj.status = "ended"
                    $voteObj | Add-Member -NotePropertyName "endedAt" -NotePropertyValue ((Get-Date).ToString("o")) -Force
                    Save-VotingDb $db
                    $resObj = @{ success = $true; message = "تم إنهاء التصويت بنجاح"; vote = $voteObj }
                    $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                    $response.StatusCode = 200
                    $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # 5B. Cast / Update Student Choice
                if ($action -eq "choice" -and $request.HttpMethod -eq "POST") {
                    if ($voteObj.status -ne "active") {
                        $response.StatusCode = 400
                        $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"عذراً، انتهت فترة التصويت ولا يمكن استقبال أصوات جديدة"}')
                        $response.OutputStream.Write($err, 0, $err.Length)
                        $response.OutputStream.Close()
                        continue
                    }

                    $body = Get-RequestBody $request
                    $stuId = if ($body -and $body.studentId) { $body.studentId.Trim() } else { $null }
                    $colorId = if ($body -and $body.colorId) { $body.colorId.Trim() } else { $null }

                    if (-not $stuId -or -not $colorId) {
                        $response.StatusCode = 400
                        $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"بيانات التصويت غير مكتملة"}')
                        $response.OutputStream.Write($err, 0, $err.Length)
                        $response.OutputStream.Close()
                        continue
                    }

                    # Upsert student choice
                    if (-not $voteObj.choices) { $voteObj | Add-Member -NotePropertyName "choices" -NotePropertyValue @() -Force }
                    $existing = $voteObj.choices | Where-Object { $_.studentId -eq $stuId } | Select-Object -First 1
                    if ($existing) {
                        $existing.colorId = $colorId
                        $existing.updatedAt = (Get-Date).ToString("o")
                    } else {
                        $newChoice = [PSCustomObject]@{
                            studentId = $stuId
                            colorId = $colorId
                            createdAt = (Get-Date).ToString("o")
                            updatedAt = (Get-Date).ToString("o")
                        }
                        $voteObj.choices = @($voteObj.choices) + @($newChoice)
                    }

                    Save-VotingDb $db

                    $resObj = @{ success = $true; message = "تم تسجيل اختيارك بنجاح"; vote = $voteObj }
                    $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                    $response.StatusCode = 200
                    $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # 5C. GET Vote Details
                if ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD") {
                    $stuQuery = $request.QueryString["studentId"]
                    $myChoice = $null
                    if ($stuQuery -and $voteObj.choices) {
                        $found = $voteObj.choices | Where-Object { $_.studentId -eq $stuQuery } | Select-Object -First 1
                        if ($found) { $myChoice = $found.colorId }
                    }

                    $resObj = @{ success = $true; vote = $voteObj; myChoice = $myChoice }
                    $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                    $response.StatusCode = 200
                    $response.ContentLength64 = $outBytes.Length
                    if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($outBytes, 0, $outBytes.Length) }
                    $response.OutputStream.Close()
                    continue
                }
            }
        }

        # -----------------------------------------------------------------
        # API ROUTE: /api/universities
        # -----------------------------------------------------------------
        if ($relPath -eq "api/universities" -or $relPath -eq "api/universities/") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Cache-Control", "public, max-age=3600")
            $unisPath = Join-Path $PSScriptRoot "universities.json"
            $rawUnis = if ([System.IO.File]::Exists($unisPath)) { [System.IO.File]::ReadAllText($unisPath, [System.Text.Encoding]::UTF8) } else { "[]" }
            $jsonOut = "{""success"":true,""universities"":$rawUnis}"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonOut)
            $response.StatusCode = 200
            $response.ContentLength64 = $bytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            $response.OutputStream.Close()
            continue
        }

        # -----------------------------------------------------------------
        # API ROUTE: /api/batch/* (Batch Representative Portal)
        # -----------------------------------------------------------------
        if ($relPath.StartsWith("api/batch") -or $relPath -eq "api/batch") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Cache-Control", "no-store, no-cache, must-revalidate")
            $subPath = if ($relPath.Length -gt 9) { $relPath.Substring(9).Trim('/') } else { "" }

            # Helper to load batches
            function Get-BatchesDb {
                [void]$batchMutex.WaitOne(5000)
                try {
                    $raw = if ([System.IO.File]::Exists($batchesDbPath)) { [System.IO.File]::ReadAllText($batchesDbPath, [System.Text.Encoding]::UTF8) } else { "[]" }
                    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
                    $p = ConvertFrom-Json $raw
                    if ($p -is [PSCustomObject] -and $p.PSObject.Properties['value']) { return @($p.value) } else { return @($p) }
                } finally {
                    $batchMutex.ReleaseMutex()
                }
            }

            # Helper to save batches
            function Save-BatchesDb($arr) {
                [void]$batchMutex.WaitOne(5000)
                try {
                    $jsonStr = if ($arr.Count -eq 0) { "[]" } elseif ($arr.Count -eq 1) { "[" + (ConvertTo-Json $arr[0] -Depth 10) + "]" } else { ConvertTo-Json $arr -Depth 10 }
                    [System.IO.File]::WriteAllText($batchesDbPath, $jsonStr, $utf8NoBom)
                } finally {
                    $batchMutex.ReleaseMutex()
                }
            }

            # 1. GET /api/batch/all
            if ($subPath -eq "all" -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
                $bList = @(Get-BatchesDb)
                $jsonString = ""
                if ($bList.Count -eq 0) {
                    $jsonString = '{"success":true,"count":0,"batches":[]}'
                } elseif ($bList.Count -eq 1) {
                    $itemJson = ConvertTo-Json $bList[0] -Depth 10
                    $jsonString = '{"success":true,"count":1,"batches":[' + $itemJson + ']}'
                } else {
                    $resObj = @{ success = $true; count = $bList.Count; batches = $bList }
                    $jsonString = ConvertTo-Json $resObj -Depth 10
                }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
                $response.StatusCode = 200
                $response.ContentLength64 = $outBytes.Length
                if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($outBytes, 0, $outBytes.Length) }
                $response.OutputStream.Close()
                continue
            }

            # 2. POST /api/batch/create
            if ($subPath -eq "create" -and $request.HttpMethod -eq "POST") {
                $body = Get-RequestBody $request
                if (-not $body -or -not $body.university -or -not $body.college -or -not $body.repName -or -not $body.repPhone) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"يرجى إكمال بيانات الجامعة والكلية واسم وهاتف الممثل"}')
                    $response.ContentLength64 = $err.Length
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $randId = "BATCH-" + (Get-Date).ToString("yyMMdd") + "-" + (Get-Random -Minimum 100 -Maximum 999)
                $newBatch = [PSCustomObject]@{
                    id = $randId
                    title = if ($body.title) { $body.title } else { "دفعة " + $body.college + " — " + $body.university }
                    university = $body.university
                    college = $body.college
                    repName = $body.repName
                    repPhone = $body.repPhone
                    color = if ($body.color) { $body.color } else { "burgundy" }
                    colorName = if ($body.colorName) { $body.colorName } else { "ماروني خامة" }
                    targetQty = if ($body.targetQty) { [int]$body.targetQty } else { 50 }
                    status = "مفتوح للتسجيل"
                    createdAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
                    students = @()
                }

                $bList = @(Get-BatchesDb)
                $bList = @($newBatch) + @($bList)
                Save-BatchesDb $bList

                $resObj = @{ success = $true; message = "تم إنشاء بوابة الدفعة بنجاح"; batchId = $randId; batch = $newBatch }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                $response.StatusCode = 201
                $response.ContentLength64 = $outBytes.Length
                $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 3. POST /api/batch/:id/join
            if ($subPath -match '^([a-zA-Z0-9\-_]+)/join$' -and $request.HttpMethod -eq "POST") {
                $batchId = $Matches[1]
                $body = Get-RequestBody $request
                if (-not $body -or -not $body.name -or -not $body.phone) {
                    $response.StatusCode = 400
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"يرجى إدخال اسم الطالب ورقم هاتفه"}')
                    $response.ContentLength64 = $err.Length
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $bList = @(Get-BatchesDb)
                $found = $null
                for ($i = 0; $i -lt $bList.Count; $i++) {
                    if ($bList[$i].id -eq $batchId) {
                        $found = $bList[$i]
                        $stId = "ST-" + (Get-Date).ToString("mmss") + "-" + (Get-Random -Minimum 10 -Maximum 99)
                        $newStudent = [PSCustomObject]@{
                            id = $stId
                            name = $body.name.Trim()
                            phone = $body.phone.Trim()
                            gender = if ($body.gender) { $body.gender } else { "men" }
                            sizeLetter = if ($body.sizeLetter) { $body.sizeLetter } else { "L" }
                            sizeNumber = if ($body.sizeNumber) { [int]$body.sizeNumber } else { 52 }
                            height = if ($body.height) { [int]$body.height } else { 170 }
                            embroideryName = if ($body.embroideryName) { $body.embroideryName } else { $body.name.Trim() }
                            calligraphy = if ($body.calligraphy) { $body.calligraphy } else { "thuluth" }
                            thread = if ($body.thread) { $body.thread } elseif ($body.threadColor) { $body.threadColor } else { "gold" }
                            threadColor = if ($body.threadColor) { $body.threadColor } elseif ($body.thread) { $body.thread } else { "gold" }
                            notes = if ($body.notes) { $body.notes } else { "" }
                            joinedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
                        }
                        $curSt = @($bList[$i].students)
                        $bList[$i].students = @($curSt) + @($newStudent)
                        break
                    }
                }

                if (-not $found) {
                    $response.StatusCode = 404
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"دفعة التخرج غير موجودة"}')
                    $response.ContentLength64 = $err.Length
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }

                Save-BatchesDb $bList
                $resObj = @{ success = $true; message = "تم تسجيلك في الدفعة بنجاح"; student = $newStudent }
                $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                $response.StatusCode = 200
                $response.ContentLength64 = $outBytes.Length
                $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 4. GET /api/batch/:id
            if ($subPath -match '^([a-zA-Z0-9\-_]+)$' -and ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD")) {
                $batchId = $Matches[1]
                $bList = @(Get-BatchesDb)
                $found = $bList | Where-Object { $_.id -eq $batchId } | Select-Object -First 1
                if ($found) {
                    $resObj = @{ success = $true; batch = $found }
                    $outBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                    $response.StatusCode = 200
                    $response.ContentLength64 = $outBytes.Length
                    if ($request.HttpMethod -ne "HEAD") { $response.OutputStream.Write($outBytes, 0, $outBytes.Length) }
                    $response.OutputStream.Close()
                    continue
                } else {
                    $response.StatusCode = 404
                    $err = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"دفعة التخرج غير موجودة"}')
                    $response.ContentLength64 = $err.Length
                    $response.OutputStream.Write($err, 0, $err.Length)
                    $response.OutputStream.Close()
                    continue
                }
            }
        }

        # -----------------------------------------------------------------
        # API ROUTE: /api/orders
        # -----------------------------------------------------------------
        if ($relPath.StartsWith("api/orders") -or $relPath -eq "api/orders") {
            $response.ContentType = "application/json; charset=utf-8"
            $response.AddHeader("Cache-Control", "no-store, no-cache, must-revalidate")
            $parts = $relPath.Split('/')
            $orderId = if ($parts.Length -ge 3) { $parts[2] } else { $null }

            # Thread-safe database reading
            [void]$dbMutex.WaitOne(5000)
            $ordersList = @()
            try {
                $dbContent = [System.IO.File]::ReadAllText($ordersDbPath, [System.Text.Encoding]::UTF8)
                $parsed = if ([string]::IsNullOrWhiteSpace($dbContent)) { @() } else { ConvertFrom-Json $dbContent }
                if ($parsed -is [PSCustomObject] -and $parsed.PSObject.Properties['value']) {
                    $ordersList = @($parsed.value)
                } else {
                    $ordersList = @($parsed)
                }
            } finally {
                $dbMutex.ReleaseMutex()
            }

            # 1. GET or HEAD Orders
            if ($request.HttpMethod -eq "GET" -or $request.HttpMethod -eq "HEAD") {
                if ($orderId) {
                    # Anyone can query their specific order by ID or Phone for tracking
                    $found = $ordersList | Where-Object { $_.id -eq $orderId -or $_.phone -eq $orderId } | Select-Object -First 1
                    if ($found) {
                        $jsonOut = ConvertTo-Json $found -Depth 10 -Compress
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonOut)
                        $response.StatusCode = 200
                        $response.ContentLength64 = $bytes.Length
                        if ($request.HttpMethod -ne "HEAD") {
                            $response.OutputStream.Write($bytes, 0, $bytes.Length)
                        }
                    } else {
                        $response.StatusCode = 404
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"الطلب غير موجود"}')
                        $response.ContentLength64 = $bytes.Length
                        if ($request.HttpMethod -ne "HEAD") {
                            $response.OutputStream.Write($bytes, 0, $bytes.Length)
                        }
                    }
                } else {
                    # Listing all orders requires admin auth
                    $adminPin = $request.Headers["X-Admin-Pin"]
                    if ($adminPin -ne "1234") {
                        $response.StatusCode = 401
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"غير مصرح: يرجى إدخال رمز الأمان للوحة الإدارة"}')
                        $response.ContentLength64 = $bytes.Length
                        if ($request.HttpMethod -ne "HEAD") {
                            $response.OutputStream.Write($bytes, 0, $bytes.Length)
                        }
                        $response.OutputStream.Close()
                        continue
                    }

                    $arr = @($ordersList)
                    $jsonOut = if ($arr.Count -eq 0) { "[]" } elseif ($arr.Count -eq 1) { "[" + (ConvertTo-Json $arr[0] -Depth 10 -Compress) + "]" } else { ConvertTo-Json $arr -Depth 10 -Compress }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonOut)
                    $response.StatusCode = 200
                    $response.ContentLength64 = $bytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    }
                }
                $response.OutputStream.Close()
                continue
            }

            # 2. POST New Order (With Server-Side Payload Validation)
            if ($request.HttpMethod -eq "POST") {
                if ($request.ContentLength64 -gt 2097152) {
                    $response.StatusCode = 413
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"حجم الطلب كبير جدا"}')
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $newOrder = ConvertFrom-Json $body

                # Validation checks
                if (-not $newOrder.name -or -not $newOrder.phone -or -not $newOrder.address) {
                    $response.StatusCode = 400
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"يرجى إكمال بيانات الاسم والهاتف والعنوان"}')
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Generate Order ID if not present
                if (-not $newOrder.id) {
                    $dateCode = (Get-Date).ToString("yyMMdd")
                    $randNum = Get-Random -Minimum 1000 -Maximum 9999
                    $newOrder | Add-Member -NotePropertyName "id" -NotePropertyValue "KH-$dateCode-$randNum" -Force
                }

                # Set initial status and metadata
                if (-not $newOrder.status) {
                    $newOrder | Add-Member -NotePropertyName "status" -NotePropertyValue "جديد" -Force
                }
                if (-not $newOrder.createdAt) {
                    $newOrder | Add-Member -NotePropertyName "createdAt" -NotePropertyValue ((Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")) -Force
                }

                # Thread-safe write
                [void]$dbMutex.WaitOne(5000)
                try {
                    $updatedList = @($newOrder) + @($ordersList)
                    $arr = @($updatedList)
                    $jsonDb = if ($arr.Count -eq 1) { "[" + (ConvertTo-Json $arr[0] -Depth 10) + "]" } else { ConvertTo-Json $arr -Depth 10 }
                    [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, $utf8NoBom)
                } finally {
                    $dbMutex.ReleaseMutex()
                }

                $response.StatusCode = 201
                $resObj = @{ success = $true; orderId = $newOrder.id; order = $newOrder }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $resObj -Depth 10))
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 3. PUT / Status Update
            if ($request.HttpMethod -eq "PUT" -and $orderId) {
                if ($request.Headers["X-Admin-Pin"] -ne "1234") {
                    $response.StatusCode = 401
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"غير مصرح: يرجى إدخال رمز الأمان"}')
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $updateData = ConvertFrom-Json $body

                [void]$dbMutex.WaitOne(5000)
                try {
                    $updated = $false
                    for ($i = 0; $i -lt $ordersList.Count; $i++) {
                        if ($ordersList[$i].id -eq $orderId) {
                            if ($updateData.status) { $ordersList[$i].status = $updateData.status }
                            if ($updateData.notes) { $ordersList[$i].adminNotes = $updateData.notes }
                            $updated = $true
                            break
                        }
                    }

                    if ($updated) {
                        $arr = @($ordersList)
                        $jsonDb = if ($arr.Count -eq 1) { "[" + (ConvertTo-Json $arr[0] -Depth 10) + "]" } else { ConvertTo-Json $arr -Depth 10 }
                        [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, $utf8NoBom)
                        $response.StatusCode = 200
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true,"message":"تم تحديث حالة الطلب"}')
                    } else {
                        $response.StatusCode = 404
                        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"الطلب غير موجود للتحديث"}')
                    }
                } finally {
                    $dbMutex.ReleaseMutex()
                }

                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
                continue
            }

            # 4. DELETE Order
            if ($request.HttpMethod -eq "DELETE" -and $orderId) {
                if ($request.Headers["X-Admin-Pin"] -ne "1234") {
                    $response.StatusCode = 401
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"غير مصرح: يرجى إدخال رمز الأمان"}')
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                [void]$dbMutex.WaitOne(5000)
                try {
                    $filtered = @($ordersList | Where-Object { $_.id -ne $orderId })
                    $arr = @($filtered)
                    $jsonDb = if ($arr.Count -eq 0) { "[]" } elseif ($arr.Count -eq 1) { "[" + (ConvertTo-Json $arr[0] -Depth 10) + "]" } else { ConvertTo-Json $arr -Depth 10 }
                    [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, $utf8NoBom)
                } finally {
                    $dbMutex.ReleaseMutex()
                }

                $response.StatusCode = 200
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true,"message":"تم حذف الطلب"}')
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $response.OutputStream.Close()
                continue
            }
        }

        # -----------------------------------------------------------------
        # STATIC HTML & ASSET ROUTING WITH PATH TRAVERSAL DEFENSE
        # -----------------------------------------------------------------
        if ([string]::IsNullOrWhiteSpace($relPath) -or $relPath -eq "index") {
            $filePath = Join-Path $rootDir "index.html"
        } elseif ($relPath.StartsWith("products") -or $relPath -like "*منتجات*" -or $rawPath -like "*%D9%85%D9%86%D8%AA%D8%AC%D8%A7%D8%AA*") {
            $filePath = Join-Path $rootDir "products.html"
        } elseif ($relPath.StartsWith("class") -or $relPath -like "*دفعة*" -or $relPath -like "*دفعه*" -or $rawPath -like "*%D8%AF%D9%81%D8%B9*") {
            $filePath = Join-Path $rootDir "class.html"
        } elseif ($relPath.StartsWith("checkout") -or $relPath -like "*طلب*" -or $rawPath -like "*%D8%B7%D9%84%D8%A8*") {
            $filePath = Join-Path $rootDir "checkout.html"
        } elseif ($relPath.StartsWith("admin") -or $relPath -like "*ادارة*" -or $relPath -like "*إدارة*") {
            $filePath = Join-Path $rootDir "admin.html"
        } elseif ($relPath.StartsWith("track") -or $relPath -like "*تتبع*" -or $rawPath -like "*%D8%AA%D8%AA%D8%A8%D8%B9*") {
            $filePath = Join-Path $rootDir "track.html"
        } elseif ($relPath.StartsWith("models") -or $relPath -like "*نماذج*" -or $rawPath -like "*%D9%86%D9%85%D8%A7%D8%B0%D8%AC*") {
            $filePath = Join-Path $rootDir "models.html"
        } elseif ($relPath.StartsWith("vote") -or $relPath -like "*تصويت*" -or $rawPath -like "*%D8%AA%D8%B5%D9%88%D9%8A%D8%AA*") {
            $filePath = Join-Path $rootDir "vote.html"
        } elseif ($relPath.StartsWith("blog")) {
            $response.StatusCode = 301
            $response.RedirectLocation = "/"
            $response.OutputStream.Close()
            continue
        } elseif ($relPath -like "*قياس*" -or $relPath.StartsWith("size") -or $rawPath -like "*%D9%82%D9%8A%D8%A7%D8%B3*") {
            if ([System.IO.File]::Exists((Join-Path $rootDir "قياس.html"))) {
                $filePath = Join-Path $rootDir "قياس.html"
            } else {
                $filePath = Join-Path $rootDir "size.html"
            }
        } else {
            $filePath = Join-Path $rootDir ($relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
            if (-not [System.IO.File]::Exists($filePath)) {
                if ([System.IO.File]::Exists($filePath + ".html")) {
                    $filePath = $filePath + ".html"
                } else {
                    $altPath = Join-Path $rootDir (Join-Path "khamaiq.com" ($relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
                    if ([System.IO.File]::Exists($altPath)) {
                        $filePath = $altPath
                    } elseif ([System.IO.File]::Exists($altPath + ".html")) {
                        $filePath = $altPath + ".html"
                    }
                }
            }
        }

        # Canonical path traversal defense (OWASP A03 / A01)
        $canonicalFile = [System.IO.Path]::GetFullPath($filePath)
        if (-not $canonicalFile.StartsWith($canonicalRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden: Access Denied")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $errBytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
            $response.OutputStream.Close()
            continue
        }

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = "application/octet-stream" }

            $response.ContentType = $mime

            # Cache-Control Strategy (no-cache to allow immediate visual updates)
            $response.AddHeader("Cache-Control", "no-cache, must-revalidate")

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $notFoundPath = Join-Path $rootDir "404.html"
            if ([System.IO.File]::Exists($notFoundPath)) {
                $errBytes = [System.IO.File]::ReadAllBytes($notFoundPath)
                $response.ContentType = "text/html; charset=utf-8"
            } else {
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentType = "text/plain; charset=utf-8"
            }
            $response.ContentLength64 = $errBytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
        }

        $response.OutputStream.Close()
    } catch {
        # Continue serving next requests
    }
}
