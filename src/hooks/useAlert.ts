import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertMessage, AlertType } from '../types';

export function useAlert() {
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setAlert(null);
  }, []);

  const showAlert = useCallback((type: AlertType, message: string) => {
    window.clearTimeout(timer.current);
    setAlert({ id: Date.now(), type, message });
    timer.current = window.setTimeout(() => setAlert(null), type === 'error' ? 6000 : 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { alert, showAlert, dismiss };
}
