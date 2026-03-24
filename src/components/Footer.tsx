import React from 'react';
import { Shield, GitMerge, Scissors, Minimize2, FileText, Zap } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="seo-footer">
      <noscript>
        <div className="noscript-banner">
          <p><strong>Note:</strong> PDF Toolkit requires JavaScript to process PDFs securely in your browser without sending data to a server. Please enable JavaScript to use the tools.</p>
        </div>
      </noscript>
      
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-main">
            <h2>About PDF Toolkit</h2>
            <p>PDF Toolkit is a free, privacy-first PDF management suite designed for modern web browsers. Unlike traditional online PDF editors, all processing happens entirely on your device. We do not use servers to process your data, ensuring complete privacy and security for your sensitive documents.</p>
          </div>

          <div className="footer-features">
            <h3>Key Features</h3>
            <ul className="footer-feature-list">
              <li>
                <div className="feature-icon"><Shield size={16} /></div>
                <strong>100% Client-Side</strong> - No tracking, no analytics, no server storage.
              </li>
              <li>
                <div className="feature-icon"><GitMerge size={16} /></div>
                <strong>Merge & Combine</strong> - Join multiple PDFs into a single document with ease.
              </li>
              <li>
                <div className="feature-icon"><Scissors size={16} /></div>
                <strong>Split & Extract</strong> - Break down large PDFs or extract specific pages instantly.
              </li>
              <li>
                <div className="feature-icon"><Minimize2 size={16} /></div>
                <strong>Compress PDFs</strong> - Reduce file sizes without compromising quality via local processing.
              </li>
              <li>
                <div className="feature-icon"><Zap size={16} /></div>
                <strong>Fast & Secure</strong> - Powered by WebAssembly for near-native performance right in your tab.
              </li>
              <li>
                <div className="feature-icon"><FileText size={16} /></div>
                <strong>Page Management</strong> - Rotate, reorder, or delete pages with a simple drag-and-drop interface.
              </li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} PDF Toolkit. Privacy-respecting and serverless.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
