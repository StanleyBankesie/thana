$content = Get-Content 'C:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\sales\invoices\InvoiceForm.jsx'
$depth = 0
for ($i = 0; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    $opens = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $prevDepth = $depth
    $depth += $opens - $closes
    if ($prevDepth -gt 0 -and $depth -le 0 -and $i -lt 1250) {
        Write-Host "Line $($i+1): depth went from $prevDepth to $depth | $($content[$i].Trim())"
    }
}
