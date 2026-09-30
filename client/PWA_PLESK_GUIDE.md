# PWA Plesk Hosting Troubleshooting

## Common Issues with PWA on Plesk

The PWA install button works locally but fails on Plesk due to these common issues:

### 1. **HTTPS Not Enabled**
This is the #1 reason PWA fails on Plesk.

**Check:**
- Visit your site: Does it show `https://` in the address bar?
- Or is it `http://` (without the 's')?

**Fix:**
1. Go to Plesk Control Panel
2. Navigate to **Domains** > Your Domain
3. Go to **SSL/TLS Certificates**
4. Enable/renew the SSL certificate (Let's Encrypt is free)
5. Force HTTPS redirect:
   - Go to **Security** section
   - Enable "Force HTTPS"
   - Or add to .htaccess (see below)

**.htaccess Force HTTPS:**
```apache
# Add this at the top of .htaccess in your public_html folder
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### 2. **Manifest File Not Found (404)**

The `manifest.webmanifest` file might not be deployed or might be in the wrong location.

**Check in Browser:**
1. Press F12 (DevTools)
2. Go to **Network** tab
3. Search for "manifest"
4. Click on the manifest.webmanifest request
5. Check the response status:
   - ✅ 200 = File found and working
   - ❌ 404 = File not found (this is the problem)

**Fix:**
Ensure the build output includes `manifest.webmanifest` in the dist folder:

```bash
# From client folder
npm run build
# Check if dist/manifest.webmanifest exists
ls -la dist/ | grep manifest
```

If it's missing, the Vite PWA plugin isn't generating it properly. Check that your build completes successfully and includes the manifest file.

### 3. **Service Worker Not Registered**

Service workers require HTTPS and specific path configuration.

**Check in DevTools:**
1. Press F12
2. Go to **Application** > **Service Workers**
3. You should see an active service worker
4. If empty or "waiting", the SW didn't register properly

**Common Causes:**
- HTTPS not enabled
- Service worker path issue
- Content Security Policy headers blocking it
- Browser cache issue

### 4. **Relative Path Issues with Vite**

The `base: "./"` in vite.config.js might cause issues on Plesk if:
- Your app is in a subdirectory
- Plesk uses a different routing structure

**Check Your Deployment:**
- Is your app at the root: `https://example.com/` ?
- Or in a subdirectory: `https://example.com/app/` ?

If in a subdirectory, you may need to update the base URL:
```javascript
// In vite.config.js
export default defineConfig({
  base: "/app/", // Change to your subdirectory
  // ... rest of config
});
```

Then rebuild and redeploy.

### 5. **Incorrect Icon Paths**

The manifest references icons with absolute paths `/src/assets/...` which won't exist after build.

**Check:**
In DevTools > Application > Manifest, look at the icons section. The paths should point to actual files in your dist folder, not `/src/assets/`.

This should be automatically fixed by vite-plugin-pwa, but if not, verify that icon files are in the public folder or dist after build.

### 6. **Plesk Caching Issues**

Plesk might be caching old versions of your app.

**Clear Cache:**
1. In Plesk, go to **Extensions** > **Cache Manager**
2. Clear all caches
3. Or manually clear:
   - Browser cache (Ctrl+Shift+Delete)
   - Service worker cache (DevTools > Application > Clear site data)

## Step-by-Step Fix for Plesk

### Step 1: Enable HTTPS (Required)
```
Plesk Dashboard > Domains > Your Domain > SSL/TLS Certificates
- Choose "Let's Encrypt" (free)
- Enable Auto-renewal
- Force HTTPS in Security settings
```

### Step 2: Verify Build Output
```bash
cd client
npm run build

# Check these files exist in dist/:
# - manifest.webmanifest
# - sw.js or similar service worker file
# - index.html
# - All assets referenced in manifest
```

### Step 3: Deploy to Plesk
```bash
# Copy dist folder contents to public_html on Plesk
# Ensure file permissions are correct (644 for files, 755 for folders)
```

### Step 4: Test on Plesk
1. Open your domain: `https://yourdomain.com/`
2. Press F12
3. Go to **Console** tab
4. Look for `[PWA]` messages
5. Expected to see:
   ```
   [PWA] Service Worker active: true
   [PWA] Manifest present: true
   [PWA] beforeinstallprompt event fired
   ```

### Step 5: If Still Not Working
Check for errors in Console tab:
- **CORS errors**: Manifest or service worker blocked by same-origin policy
- **404 errors**: Files not found on server
- **CSP violations**: Content Security Policy headers blocking PWA

## Plesk-Specific Configuration

### Add .htaccess for Better PWA Support
Create `.htaccess` in your public_html folder:

```apache
# Enable mod_rewrite
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Cache control for service worker (no cache)
<Files "sw.js">
  Header set Cache-Control "public, max-age=0, must-revalidate"
</Files>

# Cache control for manifest (no cache)
<Files "manifest.webmanifest">
  Header set Cache-Control "public, max-age=0, must-revalidate"
</Files>

# Cache static assets for 1 year
<FilesMatch "\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>

# Allow access to manifest
<Files "manifest.webmanifest">
  Header set Content-Type "application/manifest+json"
</Files>

# SPA routing - route all unknown URLs to index.html
<IfModule mod_rewrite.c>
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
</IfModule>
```

### Plesk Node.js App (If Running as Node)
If your Plesk setup runs the React app via Node.js:

1. Ensure Node.js version is 14+
2. Set environment variables if needed
3. Restart the Node.js app after deployment
4. Check application logs for errors

## Diagnostic Commands for Plesk SSH

If you have SSH access to Plesk:

```bash
# Check HTTPS certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check service worker file
curl -I https://yourdomain.com/sw.js
# Should return 200, not 404

# Check manifest file
curl -I https://yourdomain.com/manifest.webmanifest
# Should return 200, not 404

# Check gzip compression
curl -I -H "Accept-Encoding: gzip" https://yourdomain.com/
# Should show "Content-Encoding: gzip"
```

## Verify Installation After Fix

1. **Clear Everything:**
   - Browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
   - Service worker: DevTools > Application > Clear all (clear site data)
   - Reload page

2. **Check Console (F12 > Console):**
   ```
   [PWA] Service Worker active: true ✅
   [PWA] Manifest present: true ✅
   [PWA] beforeinstallprompt event fired ✅
   ```

3. **Check Manifest (F12 > Application > Manifest):**
   - Should show complete manifest JSON
   - No 404 errors
   - Icons properly referenced

4. **Check Service Worker (F12 > Application > Service Workers):**
   - Should show one registered service worker
   - Status: "activated and running"

5. **Try Install:**
   - Banner should appear
   - Click "Install Now"
   - Browser shows install dialog
   - After install, app appears in applications

## Still Having Issues?

Common remaining issues and solutions:

| Issue | Cause | Solution |
|-------|-------|----------|
| HTTPS shows unsafe | Self-signed cert | Use Let's Encrypt via Plesk |
| Manifest 404 | Not in dist folder | Rebuild: `npm run build` |
| Service worker 404 | Not deployed | Check dist folder, redeploy |
| Banner doesn't appear | beforeinstallprompt not firing | Check console logs, ensure HTTPS |
| Caching old version | Browser/Plesk caching | Clear caches, hard refresh (Ctrl+Shift+R) |
| CORS errors | Manifest/SW blocked | Check .htaccess headers, Plesk security settings |

## Test with Different Browsers

Sometimes one browser works, another doesn't:

- **Chrome**: Best support for PWA install
- **Edge**: Also good support
- **Firefox (Android)**: Works on mobile only
- **Safari**: Limited support (use "Add to Home Screen" instead)
- **Samsung Internet**: Full support on Android

Test on Chrome first to ensure basic PWA works, then test other browsers.

## Performance Tips for Plesk

Optimize PWA on Plesk:

1. **Enable Gzip Compression:**
   - Plesk Dashboard > Performance > Gzip Compression
   - Enable for HTML, CSS, JS

2. **Enable Caching:**
   - Plesk Dashboard > Performance > Caching
   - Use OPcache for PHP

3. **Optimize Images:**
   - Ensure icons are optimized (use PNGQUANT or similar)
   - Use appropriate sizes (192x192 and 512x512)

4. **Use CDN:**
   - Consider CloudFlare (free tier available)
   - Improves HTTPS and caching

## Next Steps

1. **Verify HTTPS is working** - This is critical
2. **Rebuild and redeploy** the client application
3. **Clear all caches** (browser, service worker, Plesk)
4. **Check DevTools console** for `[PWA]` diagnostic messages
5. **Test installation** on Chrome first
6. **Share console errors** if it still doesn't work

Run the diagnostic checklist above to identify the exact issue.
