$body = @{
    email = "delacruzmarcayaronal@gmail.com"
    password = "Test1234"
} | ConvertTo-Json

try {
    $r = Invoke-WebRequest -Uri 'http://localhost:8001/delete-account' -Method DELETE -Body $body -ContentType 'application/json' -ErrorAction Stop
    Write-Host "Status:" $r.StatusCode
    Write-Host "Body:" $r.Content
} catch {
    Write-Host "Error:" $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response:" $reader.ReadToEnd()
    }
}
