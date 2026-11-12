import { FileText, LayoutGrid, ShieldCheck } from 'lucide-react';
import ThemeSwitch from './ThemeSwitch';
import type { ThemePreference } from '../hooks/useTheme';

interface AppHeaderProps {
  theme: ThemePreference;
  onThemeChange: (pref: ThemePreference) => void;
}

export function AppHeader({ theme, onThemeChange }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <a className="brand" href="./" aria-label="PDF Toolkit home">
          <span className="brand__mark" aria-hidden="true">
            <FileText size={18} />
          </span>
          <span className="brand__text">
            <span className="brand__name">PDF Toolkit</span>
            <span className="brand__tagline">Merge, split and compress PDFs in your browser</span>
          </span>
        </a>

        <div className="app-header__actions">
          <span className="badge badge--success privacy-pill">
            <ShieldCheck size={14} aria-hidden="true" /> No server · 100% private
          </span>
          <a className="btn btn--ghost btn--sm hub-link" href="https://chrisjdj.github.io/web-tools/" title="More free tools">
            <LayoutGrid size={16} aria-hidden="true" />
            <span className="hub-link__label">All tools</span>
          </a>
          <ThemeSwitch preference={theme} onChange={onThemeChange} />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
