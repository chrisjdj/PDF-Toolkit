import React, { useRef } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import type { ThemePreference } from '../hooks/useTheme';

interface ThemeSwitchProps {
  preference: ThemePreference;
  onChange: (pref: ThemePreference) => void;
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * System / Light / Dark switch.
 * ≥640px: segmented radiogroup (arrow keys move the selection).
 * <640px: one icon button that cycles through the three modes.
 */
export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({ preference, onChange }) => {
  const groupRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, OPTIONS.findIndex(o => o.value === preference));
  const current = OPTIONS[index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const target = (index + delta + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[target].value);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]?.focus();
  };

  return (
    <>
      <div
        ref={groupRef}
        className="segmented theme-switch"
        role="radiogroup"
        aria-label="Colour theme"
        onKeyDown={onKeyDown}
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            tabIndex={preference === value ? 0 : -1}
            className="segmented__item"
            onClick={() => onChange(value)}
          >
            <Icon size={16} aria-hidden />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--icon theme-cycle"
        onClick={() => onChange(next.value)}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
        title={`Theme: ${current.label}`}
      >
        <current.Icon size={18} aria-hidden />
      </button>
    </>
  );
};

export default ThemeSwitch;
