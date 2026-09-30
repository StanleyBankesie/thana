$content = Get-Content 'C:\Users\stanl\OneDrive\Documents\serianamart\client\src\pages\modules\sales\invoices\InvoiceForm.jsx'
$depth = 0
for ($i = 0; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    $opens = ([regex]::Matches($line, '\{')).Count
    $closes = ([regex]::Matches($line, '\}')).Count
    $prevDepth = $depth
    $depth += $opens - $closes
    # Show transitions where depth goes to 0 or negative before line 1250
    if ($depth -le 0 -and $i -lt 1260) {
        Write-Host "Line $($i+1): depth=$prevDepth->$depth | $($content[$i].Trim().Substring(0, [Math]::Min(80, $content[$i].Trim().Length)))"
    }
}
