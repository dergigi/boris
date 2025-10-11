# PWA Launch Checklist

## Pre-Production

- [x] **Replace placeholder icons** with branded designs
  - ✅ 192x192px and 512x512px icons from boris-favicon.zip
  - ✅ Maskable variants (currently same as standard - can add padding if desired)
  - Optional: Use [Maskable.app](https://maskable.app/) to test and refine maskable icons
  
- [ ] **Test install flow**
  - [ ] Chrome/Edge on desktop
  - [ ] Chrome on Android
  - [ ] Safari on iOS (limited PWA support)
  
- [ ] **Test offline functionality**
  - [ ] App shell loads when offline
  - [ ] Cached images display
  - [ ] Cached articles accessible
  - [ ] Local relay still works
  - [ ] Online/offline toast notifications work
  
- [ ] **Run Lighthouse audit**
  - [ ] PWA score >90
  - [ ] All installability criteria met
  - [ ] No console errors
  
- [ ] **Test service worker updates**
  - [ ] Deploy new version
  - [ ] Verify update notification appears
  - [ ] Verify refresh loads new version

## Production

- [ ] **Verify manifest serving**
  - Check `/manifest.webmanifest` is accessible
  - Verify correct MIME type (`application/manifest+json`)
  
- [ ] **Verify service worker serving**
  - Check `/sw.js` is accessible
  - Verify correct cache headers (short cache, must-revalidate)
  
- [ ] **Verify icons serving**
  - All icon sizes load correctly
  - Proper MIME types for PNG files
  
- [ ] **Test on real devices**
  - [ ] iOS Safari (add to home screen)
  - [ ] Android Chrome (install prompt)
  - [ ] Desktop Chrome (install button)
  - [ ] Desktop Edge (install button)

## Post-Launch

- [ ] Monitor service worker registration errors (analytics/logs)
- [ ] Monitor cache hit rates (optional)
- [ ] Gather user feedback on install experience
- [ ] Consider adding advanced PWA features:
  - [ ] Web Share Target
  - [ ] Background Sync
  - [ ] Badging API
  - [ ] Push Notifications

## Known Limitations

- **iOS Safari**: Limited PWA support, no install prompt (users must "Add to Home Screen" manually)
- **Firefox**: No install prompt, but PWA features work
- **Private/Incognito**: Service workers may be disabled
- **WebSocket**: Not affected by service worker (by design)

## Troubleshooting

### Service Worker Not Registering
1. Check browser console for errors
2. Verify `/sw.js` is accessible
3. Check HTTPS is enabled (required for SW)
4. Clear browser cache and reload

### Install Prompt Not Showing
1. Verify manifest is valid (Chrome DevTools > Application > Manifest)
2. Check all installability criteria (Lighthouse PWA audit)
3. Try in Chrome/Edge (best PWA support)
4. Some browsers require user engagement before showing prompt

### Offline Not Working
1. Check service worker is active (DevTools > Application > Service Workers)
2. Verify precache manifest was generated (check `dist/sw.js`)
3. Test after first visit (SW needs initial registration)
4. Check network tab shows "(from ServiceWorker)" for cached resources

### Icons Not Showing
1. Verify icon files exist in `public/` directory
2. Check manifest references correct paths
3. Verify icon files are valid PNG format
4. Clear browser cache and reinstall app

