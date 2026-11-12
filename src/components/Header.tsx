import { FileText, Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" aria-hidden="true">
          <FileText size={24} />
        </div>
        <div className="title-area">
          <h1>PDF Toolkit</h1>
          <p>Browser-based PDF manipulation</p>
        </div>
      </div>
      <div className="privacy-badge">
        <Shield aria-hidden="true" />
        No server · 100% private
      </div>
    </header>
  );
}
