# PWA Install Notification - Implementation Guide

## Overview

The OmniSuite ERP application now includes an automatic PWA install notification banner that appears when users open the application in their browser. This allows users to install the app on their devices for faster access and offline support.

## What Was Added

### 1. Custom Hook: `useInstallPrompt.js`

Located at: [src/hooks/useInstallPrompt.js](src/hooks/useInstallPrompt.js)

This React hook manages:

- Detection of the `beforeinstallprompt` event
- Tracking whether the app is installable and installed
- Handling the install process
- Managing the prompt dismissal

**Hook API:**

```javascript
const {
  installPrompt, // The event object for triggering install
  isInstallable, // Boolean - whether app can be installed
  isInstalled, // Boolean - whether app is already installed
  handleInstall, // Function - triggers the install prompt
  dismissPrompt, // Function - dismisses the install prompt
} = useInstallPrompt();
```

### 2. PWA Install Banner Component: `PWAInstallBanner.jsx`

Located at: [src/components/PWAInstallBanner.jsx](src/components/PWAInstallBanner.jsx)

This component:

- Displays an attractive banner at the top of the app
- Shows "Install Now" button to prompt installation
- Includes a dismiss button (X) to hide the banner
- Only appears if the app is installable and not already installed
- Uses Tailwind CSS for styling and Lucide React icons

**Features:**

- Smooth slide-down animation
- Responsive design (mobile and desktop)
- Clear messaging about the benefits
- User-friendly install and dismiss options

### 3. App Integration

Updated [src/App.jsx](src/App.jsx) to:

- Import the `PWAInstallBanner` component
- Render it at the top level within the app providers
- Display to all authenticated and unauthenticated users

## How It Works

1. **On App Load:**
   - The hook listens for the browser's `beforeinstallprompt` event
   - Checks if the app is already installed
   - If installable and not installed, sets `isInstallable` to `true`

2. **Banner Display:**
   - When `isInstallable` is true, the banner appears at the top
   - Users see: app icon, installation message, "Install Now" button, and dismiss (X) button

3. **User Install:**
   - User clicks "Install Now"
   - Browser shows the native install prompt
   - User confirms installation
   - App gets added to home screen/app drawer
   - Banner automatically disappears

4. **Dismissal:**
   - User can click the X button to hide the banner
   - Banner won't appear again until browser cache is cleared

## Supported Browsers & Platforms

The install prompt works on:

### Desktop

- **Chrome/Edge**: Full support
- **Firefox**: Limited support (Android only)
- **Safari**: Partial support (iOS only)

### Mobile

- **Chrome (Android)**: Full support
- **Samsung Internet**: Full support
- **Firefox (Android)**: Full support
- **Safari (iOS)**: Limited support (uses "Add to Home Screen" instead)

## PWA Configuration

The project's PWA configuration is in [vite.config.js](../vite.config.js):

```javascript
VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  manifest: {
    id: "omnisuite-erp",
    name: "OmniSuite ERP",
    display: "standalone",
    // ... other config
  },
});
```

Key settings:

- **registerType: "autoUpdate"** - Service worker automatically updates in background
- **display: "standalone"** - App opens as standalone app, not in browser tab
- **Manifest**: Defines app name, icon, colors, and other metadata

## Manifest File

The manifest is at [manifest.webmanifest](../public/manifest.webmanifest):

```json
{
  "name": "OmniSuite ERP",
  "short_name": "OmniSuite",
  "start_url": "/",
  "display": "standalone",
  "icons": [...]
}
```

## Testing the Install Feature

### On Chrome/Edge (Desktop):

1. Open the app in Chrome or Edge
2. The banner should appear at the top
3. Click "Install Now"
4. Browser shows install confirmation
5. App is added to your applications

### On Android Chrome:

1. Open the app in Chrome
2. Banner appears
3. Tap "Install Now"
4. App is added to home screen

### On iOS Safari:

1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. (Install banner doesn't work on iOS, but manual installation is still possible)

### Simulate on Desktop:

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Go to **Manifest** section
4. Check the manifest is valid
5. In DevTools console, manually trigger:
   ```javascript
   // Simulate install prompt
   window.dispatchEvent(new Event("beforeinstallprompt"));
   ```

## Customization

### Change Banner Styling

Edit [src/components/PWAInstallBanner.jsx](src/components/PWAInstallBanner.jsx) to modify:

- Colors: Change `from-blue-600 to-blue-700` classes
- Messages: Update text in `<p>` tags
- Button styles: Modify button classes

### Change Banner Duration

Modify the animation time in the `<style>` tag (currently 0.3s)

### Auto-hide Banner After Time

Add to `PWAInstallBanner.jsx`:

```javascript
useEffect(() => {
  const timer = setTimeout(() => setShowBanner(false), 5000); // 5 seconds
  return () => clearTimeout(timer);
}, []);
```

## Troubleshooting

### Banner Not Appearing

- Check if app is served over HTTPS (required for PWA)
- Verify browser supports PWA (Chrome, Edge, Firefox, Safari)
- Check DevTools Console for errors
- Ensure manifest is valid in DevTools > Application > Manifest

### Install Button Not Working

- Browser might not support beforeinstallprompt event
- App might already be installed
- Browser might have dismissed the prompt (try clearing cache)
- On iOS, use native "Add to Home Screen" instead

### Service Worker Issues

- Clear browser cache and reload
- Go to DevTools > Application > Service Workers > Unregister
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Additional Resources

- [MDN: beforeinstallprompt event](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)
- [Web.dev: Install Prompt](https://web.dev/install-prompt/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Browser Requirements

For the install prompt to appear, the app must meet these criteria:

✅ Served over HTTPS (or localhost)
✅ Has a valid Web App Manifest
✅ Has a service worker
✅ Meets engagement requirements (varies by browser)
✅ Not already installed

All these are automatically configured with vite-plugin-pwa.
