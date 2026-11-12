import { FileText, GitMerge, Minimize2, Scissors, Shield, Zap } from 'lucide-react';

const FEATURES = [
  { Icon: Shield, title: '100% client-side', text: 'No tracking, no analytics, no server storage.' },
  { Icon: GitMerge, title: 'Merge & combine', text: 'Join pages from several PDFs into a single document.' },
  { Icon: Scissors, title: 'Split & extract', text: 'Pull out any pages or ranges instantly.' },
  { Icon: Minimize2, title: 'Compress PDFs', text: 'Reduce file size with local processing, even for scans.' },
  { Icon: Zap, title: 'Fast & secure', text: 'WebAssembly gives near-native performance right in your tab.' },
  { Icon: FileText, title: 'Page management', text: 'Rotate, reorder or remove pages with drag and drop.' },
];

export function Footer() {
  return (
    <footer className="app-footer">
      <noscript>
        <div className="noscript-banner">
          <strong>Note:</strong> PDF Toolkit needs JavaScript to process PDFs in your browser without sending data to a
          server. Please enable JavaScript to use the tools.
        </div>
      </noscript>

      <div className="container">
        <div className="app-footer__grid">
          <div>
            <h2>About PDF Toolkit</h2>
            <p>
              PDF Toolkit is a free, privacy-first PDF suite for modern browsers. Unlike traditional online PDF editors,
              all processing happens on your device. No server ever sees your documents.
            </p>
          </div>

          <div>
            <h3>Key features</h3>
            <ul className="app-footer__features">
              {FEATURES.map(({ Icon, title, text }) => (
                <li key={title}>
                  <span className="feature-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="app-footer__bottom">
          <p>&copy; {new Date().getFullYear()} PDF Toolkit. Privacy-respecting and serverless.</p>
          <a href="https://chrisjdj.github.io/web-tools/">More free tools</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
