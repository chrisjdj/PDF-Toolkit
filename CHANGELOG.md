# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-03-23

### Added
- **SEO Optimization**: Integrated `robots.txt`, `sitemap.xml`, and JSON-LD structured data for better search indexing.
  - Enhanced meta tags (Open Graph, Twitter) for better social sharing.
  - Added structured data schema for `WebApplication` and `SoftwareApplication`.
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
