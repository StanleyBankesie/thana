$content = Get-Content 'C:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\sales\invoices\InvoiceForm.jsx'
$depth = 0
for ($i = 0; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    $opens = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $depth += $opens - $closes
    if ($depth -le 0) {
        Write-Host "Line $($i+1): depth=$depth"
    }
}
