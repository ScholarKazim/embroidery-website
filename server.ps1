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
$ordersDbPath = Join-Path $rootDir "orders.json"
$ADMIN_TOKEN = "khama_admin_2026"

# Initialize orders database file if not exists
if (-not [System.IO.File]::Exists($ordersDbPath)) {
    [System.IO.File]::WriteAllText($ordersDbPath, "[]", [System.Text.Encoding]::UTF8)
}

# Mutex for thread-safe atomic database read/writes
$dbMutex = New-Object System.Threading.Mutex($false, "Global\KhamaOrdersDbMutex")

Write-Host "========================================="
Write-Host "  Ibra Wa Kheit Hardened Web & DB Server"
Write-Host "  Store:  http://localhost:$port/"
Write-Host "  Admin:  http://localhost:$port/admin"
Write-Host "  Track:  http://localhost:$port/track"
Write-Host "  API:    http://localhost:$port/api/orders"
Write-Host "========================================="

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
                if ($request.ContentLength64 -gt 262144) {
                    $response.StatusCode = 413
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"حجم الطلب كبير جداً"}')
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
                    [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, [System.Text.Encoding]::UTF8)
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
                        [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, [System.Text.Encoding]::UTF8)
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
                    [System.IO.File]::WriteAllText($ordersDbPath, $jsonDb, [System.Text.Encoding]::UTF8)
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
        } elseif ($relPath.StartsWith("products")) {
            $filePath = Join-Path $rootDir "products.html"
        } elseif ($relPath.StartsWith("class")) {
            $filePath = Join-Path $rootDir "class.html"
        } elseif ($relPath.StartsWith("checkout")) {
            $filePath = Join-Path $rootDir "checkout.html"
        } elseif ($relPath.StartsWith("admin")) {
            $filePath = Join-Path $rootDir "admin.html"
        } elseif ($relPath.StartsWith("track")) {
            $filePath = Join-Path $rootDir "track.html"
        } elseif ($relPath.StartsWith("blog")) {
            $filePath = Join-Path $rootDir "blog.html"
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

            # Cache-Control Strategy
            if ($ext -in @(".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff2", ".woff", ".ttf")) {
                $response.AddHeader("Cache-Control", "public, max-age=31536000, immutable")
            } elseif ($ext -in @(".css", ".js")) {
                $response.AddHeader("Cache-Control", "public, max-age=86400")
            } else {
                $response.AddHeader("Cache-Control", "no-cache, must-revalidate")
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentType = "text/plain"
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
