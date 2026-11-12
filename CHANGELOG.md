# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-11-12

### Changed
- **Redesigned UI** on the design system shared by all the tools in the suite (see [DESIGN.md](./DESIGN.md)). It replaces the glassmorphic look with a clean product UI: neutral surfaces, a rose accent, subtle borders and shadows. The blur, gradients, noise and glow are gone, which also makes the app lighter on low-end phones.
- **Theme switch:**
  - A System / Light / Dark control in the header replaces the floating sun/moon button.
  - System is the default; it follows the OS setting and updates live when the setting changes. On phones the switch is a single button that cycles through the three modes.
  - The choice is stored under `theme-preference` and shared with the other tools on the same origin. The old `pdf-theme` key is removed.
- **Mobile-first layout:**
  - Before a file is opened, the workspace's empty state is the only upload area, so there are no longer two upload buttons on phones.
  - From 1024px the tools sit in a sticky sidebar.
  - Fixed minimum heights are gone.
- **Page grid:**
  - The selection toolbar is sticky and wraps.
  - Rotate, delete and restore are always visible, sized 32px on desktop and 44px on touch (they were 16–20px).
  - Checkboxes have larger hit areas.
- **Merge queue:** chips are wider, with a readable position number, the file's colour and its page label.
- **Preview:** now a native `<dialog>`, which gives a focus trap, Esc to close and an inert background. It is full-screen on phones and sized with `dvh`, and its header wraps on narrow screens.
- **Smaller pieces:**
  - The tool picker is a segmented control.
  - Compress options are radio cards.
  - Messages are floating toasts (bottom on phones, top-right on desktop).
  - File colours are theme-aware tokens.

### Fixed
- Removed pages were never struck through: the CSS selector didn't match the markup. Removed pages now show a struck-through label, a "Removed" badge and a dashed border.
- White text on the old gradient buttons failed contrast (about 2.9:1), and so did the amber "Unsaved changes" text on the light background (about 1.7:1). All token pairs are now checked for WCAG 2.2 AA in both themes.
- In light mode, borders were nearly invisible and some accent colours had no light value.
- The upload area was a `div` with `role="button"`; it is now a real `<button>`.
- On phones the floating theme button covered content and the footer, and the preview dialog was cut off by the browser toolbar.
- Removed unused and duplicate CSS, and the duplicate `.gstack` entry in `.gitignore`.

### Removed
- The Outfit font. Inter Variable is now the only font.

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
- Self-hosted Inter/Outfit fonts (Outfit was dropped in 1.3.0). These were referenced before but never loaded, and self-hosting avoids third-party requests.
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
