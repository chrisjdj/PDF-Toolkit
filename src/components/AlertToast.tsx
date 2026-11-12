import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { AlertMessage } from '../types';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

/** Always-mounted live region so screen readers announce every message. */
export function AlertToast({ alert, onDismiss }: { alert: AlertMessage | null; onDismiss: () => void }) {
  const Icon = alert ? ICONS[alert.type] : null;
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {alert && Icon && (
        <div key={alert.id} className={`alert ${alert.type}`}>
          <Icon size={18} aria-hidden="true" />
          <span className="alert-message">{alert.message}</span>
          <button className="alert-close" onClick={onDismiss} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
