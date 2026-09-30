# PWA Install Notification - Troubleshooting Guide

## Quick Diagnosis

If the install banner is not visible, follow these steps to identify the issue:

### 1. Check Browser Console (F12)

Open Developer Tools and look for `[PWA]` messages to diagnose issues:

**Expected logs (when banner should appear):**

```
[PWA] Service Worker active: true
[PWA] Manifest present: true
[PWA] beforeinstallprompt event fired
```

**If beforeinstallprompt doesn't fire:**

```
[PWA] beforeinstallprompt event not triggered. Possible reasons:
1. App not served over HTTPS
2. Service Worker not registered
3. Manifest file missing or invalid
4. Browser doesn't support PWA install prompt
5. App engagement criteria not met
```

### 2. Check Your Environment

- **HTTPS Required**: PWA install only works on HTTPS (not HTTP)
  - ✅ Localhost works for development
  - ❌ HTTP remote URLs don't work
  - ✅ HTTPS works everywhere

- **Browser Support**:
  - ✅ Chrome/Edge (Windows, Mac, Linux)
  - ✅ Chrome Mobile (Android)
  - ✅ Samsung Internet
  - ✅ Firefox (Android only)
  - ❌ Safari (use native "Add to Home Screen" instead)

### 3. Enable Debug Mode for Testing

The banner now includes debug mode for testing when the real beforeinstallprompt event isn't firing:

**Option A: Via URL Parameter**

```
http://localhost:5173/?pwa-debug=true
```

**Option B: Via Browser Console**

```javascript
localStorage.setItem("pwa-debug-mode", "true");
location.reload();
```

The banner will appear with a "DEBUG MODE" badge and behave normally for testing.

## Detailed Troubleshooting Steps

### Issue 1: Banner Not Appearing at All

**Check 1: Verify the Component is Mounted**

```javascript
// In DevTools Console
document.querySelector('[class*="from-blue-600"]');
// Should return the banner element if it exists
```

**Check 2: Verify Manifest File**

```javascript
// In DevTools Console
fetch("/manifest.webmanifest")
  .then((r) => r.json())
  .then((m) => console.log("Manifest:", m))
  .catch((e) => console.error("Manifest error:", e));
```

Should return:

```json
{
  "name": "OmniSuite ERP",
  "short_name": "OmniSuite",
  "start_url": "/",
  "display": "standalone",
  ...
}
```

**Check 3: Verify Service Worker Registration**
Go to DevTools > Application > Service Workers

Should show:

- ✅ Service Worker registered and active
- ✅ Status shows "activated and running"

If not:

```javascript
// In console, manually unregister and reload
navigator.serviceWorker.getRegistrations().then((regs) => {
  regs.forEach((reg) => reg.unregister());
  location.reload();
});
```

**Check 4: Verify Manifest Link in HTML**

```javascript
// In DevTools Console
document.querySelector('link[rel="manifest"]');
// Should return: <link rel="manifest" href="/manifest.webmanifest">
```

### Issue 2: App Already Detected as Installed (Not PWA)

The banner won't show if:

- App is already installed as PWA
- Browser is in standalone mode

**To verify:**

```javascript
// In DevTools Console
window.matchMedia("(display-mode: standalone)").matches;
// Returns true if running as installed PWA
```

**To test fresh install:**

```javascript
// In DevTools Console, clear the install state:
localStorage.removeItem("pwa-debug-mode");
localStorage.clear();
sessionStorage.clear();

// Unregister service worker
navigator.serviceWorker.getRegistrations().then((regs) => {
  regs.forEach((reg) => reg.unregister());
  location.reload();
});
```

### Issue 3: Browser Version Too Old

Some browsers require minimum versions:

- Chrome: 42+
- Edge: 79+
- Firefox: 58+ (Android only)
- Safari: 11.3+ (iOS only, no install prompt)

### Issue 4: Manifest Has Issues

**Validate your manifest:**

Go to DevTools > Application > Manifest

Check for errors. Common issues:

- ❌ Missing `display: "standalone"`
- ❌ Invalid icon paths
- ❌ Missing required fields
- ❌ Invalid JSON syntax

The vite-plugin-pwa should handle this automatically, but verify:

```javascript
// Check manifest validity
fetch("/manifest.webmanifest")
  .then((r) => r.json())
  .then((m) => {
    const required = ["name", "short_name", "start_url", "display", "icons"];
    const missing = required.filter((field) => !m[field]);
    if (missing.length) console.error("Missing fields:", missing);
    else console.log("Manifest looks good!", m);
  });
```

## Testing on Different Platforms

### Chrome Desktop (Windows/Mac/Linux)

1. Open DevTools (F12)
2. Go to Application tab
3. Check "Service Workers" - should show registered
4. Refresh the page
5. Banner should appear at the top
6. Click "Install Now"
7. Browser shows native install dialog
8. Click "Install"
9. App is added to applications/start menu

### Chrome Mobile (Android)

1. Open app in Chrome
2. Banner should appear at top
3. Tap "Install Now"
4. System confirmation dialog appears
5. Tap "Install"
6. App is added to home screen
7. You can now launch directly from home screen

### Manual Testing with Debug Mode

```javascript
// Enable debug mode
localStorage.setItem("pwa-debug-mode", "true");
location.reload();
```

Banner will appear with "DEBUG MODE" label, letting you test the UI without a real install event.

## Manually Triggering Install Prompt (For Testing)

If you want to test the install flow without browser's beforeinstallprompt:

```javascript
// Simulate the prompt (debug mode)
localStorage.setItem("pwa-debug-mode", "true");
location.reload();
```

Or manually dispatch the event:

```javascript
// Create a fake install prompt event
const fakeEvent = new Event("beforeinstallprompt");
fakeEvent.preventDefault = () => {};
fakeEvent.prompt = async () => {};
fakeEvent.userChoice = Promise.resolve({ outcome: "accepted" });

window.dispatchEvent(fakeEvent);
```

## Checking PWA Compliance

Use these tools to verify your PWA setup:

### Google Lighthouse (Built into DevTools)

1. Open DevTools
2. Go to Lighthouse tab
3. Select "PWA" category
4. Click "Analyze page load"
5. Check for PWA compliance issues

### Web.dev Measure

Visit: https://web.dev/measure/

- Enter your app URL
- Get detailed PWA checklist
- See what's missing or broken

## Production Deployment Checklist

Before deploying to production:

✅ HTTPS enabled on domain
✅ Valid manifest.webmanifest at root
✅ Service worker registered and working
✅ App shell works offline
✅ Icons are 192x192 and 512x512 PNG
✅ Manifest has required fields
✅ Start URL configured correctly
✅ Theme colors match design

## Common Issues & Fixes

| Issue                           | Cause                         | Fix                                                                   |
| ------------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| Banner not appearing            | Service worker not registered | Hard refresh (Ctrl+Shift+R), clear cache, check DevTools              |
| Banner not appearing            | Manifest file 404             | Verify manifest link in index.html, check manifest.webmanifest exists |
| "Install Now" does nothing      | No beforeinstallprompt event  | Enable debug mode, check browser support, verify HTTPS                |
| App already installed           | Running as PWA                | Not an issue, banner won't show (by design)                           |
| Banner dismissed, won't return  | User dismissed it             | Clear localStorage: `localStorage.clear()` and reload                 |
| Works in dev, not in production | HTTP used instead of HTTPS    | Deploy on HTTPS only                                                  |

## Advanced: Custom Install Behavior

To customize when/how the banner appears, edit [src/components/PWAInstallBanner.jsx](src/components/PWAInstallBanner.jsx):

```jsx
// Show banner immediately instead of waiting for event
useEffect(() => {
  setShowBanner(true); // Always show for testing
}, []);

// Auto-hide after 10 seconds
useEffect(() => {
  if (showBanner) {
    const timer = setTimeout(() => setShowBanner(false), 10000);
    return () => clearTimeout(timer);
  }
}, [showBanner]);
```

## Still Not Working?

1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear all caches**: DevTools > Application > Clear site data
3. **Unregister service workers**: DevTools > Service Workers > Unregister all
4. **Check console**: Look for any JavaScript errors
5. **Use debug mode**: Add `?pwa-debug=true` to URL for testing
6. **Try different browser**: Test on Chrome if using Safari
7. **Test on localhost first**: More reliable than remote URLs
8. **Use Lighthouse**: Get detailed compliance report

## Getting More Help

- [MDN: beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)
- [Web.dev: Install Prompt](https://web.dev/install-prompt/)
- [Chrome DevTools: PWA](https://developer.chrome.com/docs/devtools/progressive-web-apps/)
- [PWA Checklist](https://web.dev/pwa-checklist/)
