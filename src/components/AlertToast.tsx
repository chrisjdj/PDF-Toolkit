import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { AlertMessage } from '../types';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const VARIANTS = { success: 'alert--success', error: 'alert--danger', info: 'alert--info' };

/** Always-mounted live region so screen readers announce every message. */
export function AlertToast({ alert, onDismiss }: { alert: AlertMessage | null; onDismiss: () => void }) {
  const Icon = alert ? ICONS[alert.type] : null;
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {alert && Icon && (
        <div key={alert.id} className={`alert ${VARIANTS[alert.type]}`}>
          <Icon size={18} aria-hidden="true" />
          <span className="alert__body">{alert.message}</span>
          <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={onDismiss} aria-label="Dismiss message">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
