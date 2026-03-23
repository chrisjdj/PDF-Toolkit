# PDF Toolkit 📄🔨

A powerful, browser-based PDF manipulation toolkit that puts privacy first. All processing happens locally in your browser—your files never leave your computer. Optimized for speed and security.

**Live Demo**: [https://chrisjdj.github.io/web-tools/PDF-Toolkit](https://chrisjdj.github.io/web-tools/PDF-Toolkit)

## 🚀 Features

- **Split PDF**: Extract specific page ranges into new documents.
- **Merge PDF**: Combine pages from multiple PDF files, reorder them, and rotate as needed.
- **Compress PDF**: Optimize and reduce PDF file size for easier sharing.
- **Page Management**: 
  - **Rotate**: Change page orientation (90° increments) with optimized performance.
  - **Reorder**: Drag and drop pages to change their sequence.
  - **Delete**: Remove unwanted pages from your document.
- **Performance Optimized**: 
  - **Lazy Loading**: Thumbnails are loaded only when visible using `IntersectionObserver`.
  - **Efficient Rendering**: Minimized re-renders for smoother page interactions.
- **Preview**: High-quality page thumbnails and full-page zoom view.
- **Theme Support**: Premium glassmorphic design with dark and light modes.
- **Privacy First**: 100% client-side processing. No server, no uploads, 100% private.

## 🔍 SEO & Accessibility

- **Optimized for Search**: Includes `robots.txt`, `sitemap.xml`, and comprehensive meta tags for better visibility.
- **Structured Data**: JSON-LD schema markup for enhanced search engine results.
- **Accessible Design**: Semantic HTML and improved ARIA labels for screen reader compatibility.

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **PDF Manipulation**: [pdf-lib](https://pdf-lib.js.org/)
- **PDF Rendering**: [pdf.js](https://mozilla.github.io/pdf.js/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Sass (SCSS)

## 🏗️ Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## 🔒 Privacy & Security

This application is designed to be completely private. It uses `pdf-lib` and `pdfjs-dist` to process PDF files directly in your browser's memory. No data is sent to any external server. 

---

*Built with ❤️ for productivity and privacy.*
