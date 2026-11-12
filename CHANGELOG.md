# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-11-12

### Fixed
- **Compress now works.** The qpdf WASM module was used before it finished loading, so compression always failed.
- Compress keeps your page edits (removed, reordered and rotated pages) instead of compressing the original file.
- Uploading several PDFs at once could leave the viewer blank or showing the wrong file; each file is now parsed once.
- Password-protected PDFs are detected and skipped with a clear message. PDFs that only restrict editing (owner password) can now be opened and exported.
- `.PDF` files with an uppercase extension are accepted.
- Removing a file now also removes its pages from the merge queue and frees its memory.
- Preview: rapid zoom or page changes no longer cause render errors; the page fits the window and is sharp on high-DPI screens.
- Messages no longer disappear early when a new one arrives.
- Downloads are more reliable in Safari and Firefox.
- On touch screens, swiping over thumbnails scrolls the page again. Reordering uses a long press.

### Added
- **Strong compression**: downsizes and re-encodes large photos/scans (2.8 MB → 172 KB on a photo-heavy test file).
- Split takes page ranges such as `1-3, 7, 10-`, validated as you type.
- Edits are kept per file, so switching between files no longer discards them.
- Keyboard support: page cards and merge queue items are focusable. Alt+arrows reorder, Enter previews, Space selects, R rotates, Delete removes. The preview dialog supports ←/→, +/−, 0 and Esc, and traps focus.
- Drop PDFs anywhere on the workspace; new empty state with a feature overview.
- Self-hosted Inter/Outfit fonts. These were referenced before but never loaded, and self-hosting avoids third-party requests.
- `prefers-reduced-motion` support, skip link, screen-reader announcements for messages.

### Changed
- **Initial JavaScript reduced from 2.94 MB to 273 KB** (1.02 MB → 86 KB gzipped). pdf.js, pdf-lib and qpdf are loaded only when first needed.
- Removed the JavaScript obfuscator (slower runtime, larger bundle) and the unused `pdf-lib` dependency.
- Removed the hand-written PDF writer used by "Save"; all exports use pdf-lib, copying shared resources once per source file.
- Thumbnails use JPEG object URLs at device pixel ratio instead of PNG data URLs.
- `App.tsx` (1,900 lines) split into components, hooks, reducers and `lib/` modules.
- Added `eslint.config.js` so `npm run lint` works; `package-lock.json` is now committed.

## [1.1.0] - 2026-03-23

### Added
- **SEO Optimization**: Integrated `robots.txt`, `sitemap.xml`, and JSON-LD structured data for better search indexing.
  - Enhanced meta tags (Open Graph, Twitter) for better social sharing.
  - Added structured data schema for `WebApplication`.
- **Accessibility Improvements**: Upgraded semantic HTML structure and added descriptive ARIA labels for core UI components.
- **UI Enhancements**: Refreshed design with a modern glassmorphic look and feel, including improved button states and layouts.

### Changed
- **Performance Optimization**: Implemented lazy loading for PDF thumbnails using `IntersectionObserver`.
  - Reduced memory footprint by only rendering thumbnails currently in view.
  - Optimized the reordering and rotation logic to minimize React re-renders.

## [1.0.0] - 2026-03-19

### Added
- Initial release of PDF Toolkit.
- Merge PDF functionality with page reordering and rotation.
- Split PDF functionality with page range extraction.
- Compress PDF functionality.
- Page-level editing (Rotate, Delete).
- Browser-based PDF previewer with zoom.
- Dark and light theme support.
- 100% client-side processing architecture.
