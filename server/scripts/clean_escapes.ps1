$path = "server/routes/purchase.routes.js"
$content = Get-Content $path -Raw
# Replace \` with `
$content = $content.Replace("\`", "`")
# Replace \$ with $
$content = $content.Replace("\$", "$")
Set-Content $path $content -NoNewline
