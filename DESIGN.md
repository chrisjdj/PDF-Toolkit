# Design system

PDF Toolkit shares one design system with the other tools in the suite ([TurboImage](https://chrisjdj.github.io/Turbo-Image/), [QR Generator](https://chrisjdj.github.io/QR-Code-Gen/), [PDF Toolkit](https://chrisjdj.github.io/PDF-Toolkit/) and the [Web Tools hub](https://chrisjdj.github.io/web-tools/)). The look is a clean product UI: neutral surfaces, one accent colour per app, subtle borders and shadows, with no glass, blur or gradients.

The repos are separate, so the shared files are **copied** into each one. When you change a shared file, copy the change into the other repos too.

| File | Shared? | Purpose |
|---|---|---|
| `src/styles/_tokens.scss` | Shared | Breakpoints, mixins, scales, light and dark colour tokens |
| `src/styles/_theme.scss` | Shared | Wires tokens to `:root`, the OS preference and `data-theme` |
| `src/styles/_base.scss` | Shared | Reset, typography, focus ring, utilities, motion preferences |
| `src/styles/_components.scss` | Shared | Buttons, cards, fields, badges, alerts, dialog and so on |
| `src/styles/_shell.scss` | Shared | Header, theme switch, tool layout, footer |
| `src/styles/_accent.scss` | **Per app** | The app's accent colour in light and dark |
| `src/styles/_app.scss` | **Per app** | App-only components |

## Theme

Users choose **System** (the default), **Light** or **Dark** from the switch in the header. On screens narrower than 640px the switch becomes one button that cycles through the three modes.

- **System** follows the OS setting and updates live when it changes. CSS (`prefers-color-scheme`) and the `media`-qualified `<meta name="theme-color">` tags handle this, so no JavaScript listener is needed.
- **Light** and **Dark** set `<html data-theme="light|dark">`. The choice is saved in `localStorage['theme-preference']`. Choosing System removes the key.
- An inline script in `index.html` applies the saved choice **before first paint**, so the page never flashes the wrong theme. It also deletes the legacy keys `theme` and `pdf-theme`, which earlier versions wrote even when the user hadn't chosen anything.
- All tools run on the same origin (`chrisjdj.github.io`), so one choice applies across the suite. Open tabs stay in sync through the `storage` event.
- Without JavaScript the page still follows the OS theme.
- `src/hooks/useTheme.ts` and `src/components/ThemeSwitch.tsx` keeps the `<html>` attributes, the theme-color metas and the switch in sync.

```text
<html>                     follows the OS (prefers-color-scheme)
<html data-theme="light">  forced light
<html data-theme="dark">   forced dark
```

## Tokens

Components use **semantic tokens only**. Never hard-code a colour. The one exception is UI drawn on top of arbitrary user content, such as a slider handle over an image; it uses fixed high-contrast colours and a comment explains why.

| Group | Tokens |
|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-hover`, `--surface-active`, `--overlay`, `--header-bg` |
| Borders | `--border` (decorative), `--border-strong` (form controls, at least 3:1), `--divider` |
| Text | `--text`, `--text-muted`, `--text-subtle` (all at least 4.5:1 on surfaces) |
| Accent | `--accent`, `--accent-hover`, `--accent-active`, `--on-accent`, `--accent-subtle-bg`, `--accent-subtle-border`, `--accent-subtle-text`, `--focus-ring` |
| Status | `--{success,warning,danger,info}-{text,bg,border}`, plus `--danger`, `--danger-hover`, `--on-danger` for solid destructive buttons |
| Spacing | `--space-1` to `--space-12` (4px grid) |
| Type | `--text-xs` to `--text-3xl` (2xl and 3xl are fluid), `--font-sans` (Inter Variable), `--font-mono` |
| Radius | `--radius-sm` 6, `--radius-md` 8, `--radius-lg` 12, `--radius-full` |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg` (tuned separately for each theme) |
| Layering | `--z-sticky` 100, `--z-dropdown` 200, `--z-overlay` 300, `--z-modal` 400, `--z-toast` 500 |
| Motion | `--duration-fast` 120ms, `--duration-base` 200ms, `--ease-out` |
| Sizing | `--control-h` 36px (44px on touch), `--control-h-sm`, `--control-h-lg`, `--header-height`, `--sidebar-width`, `--gutter` |

### Accent colours

| App | Light | Dark | Text on accent |
|---|---|---|---|
| TurboImage | teal `#0f766e` | `#2dd4bf` | white 5.5:1 / near-black 10.6:1 |
| QR Generator | indigo `#4f46e5` | `#818cf8` | white 6.3:1 / near-black 6.6:1 |
| PDF Toolkit | rose `#e11d48` | `#fb7185` | white 4.7:1 / near-black 7.4:1 |
| Hub | neutral `#18181b` | `#fafafa` | 17:1+ |

PDF Toolkit uses rose instead of red so that primary buttons are never mistaken for the red danger colour.

## Layout and breakpoints

The layout is mobile-first and uses `min-width` breakpoints through the `t.up()` mixin:

| Name | Width | Changes |
|---|---|---|
| (base) | 0 | One column, 16px gutter, 56px header, toasts at the bottom |
| `sm` | 640px | Full theme switch and privacy badge shown |
| `md` | 768px | 24px gutter, 64px header, tagline shown, toasts top-right |
| `lg` | 1024px | Tool layout becomes a sticky 320px sidebar beside the workspace, 32px gutter |
| `xl` | 1280px | Content capped at `--container-max` (1280px) |

- **Order.** In the DOM the workspace (the primary task) comes first and the sidebar second, so mobile users and screen readers reach the main action first. At `lg` the grid moves the sidebar into the left column.
- **Viewport units.** Use `dvh` instead of `vh`, so mobile browser toolbars don't cut off content.
- **Hover.** Hover styles only apply on devices that can hover (`t.hover`). Hover changes colour or shadow, never size or position.
- **Touch targets.** On coarse pointers (`t.coarse`) controls grow to 44px.

## Components

| Component | Classes | Notes |
|---|---|---|
| Button | `.btn` plus `--primary`, `--secondary`, `--ghost`, `--danger`, `--danger-ghost`, `--dashed`; sizes `--sm`, `--lg`, `--block`, `--icon` | `aria-pressed="true"` gives the selected style |
| Card | `.card`, `__header`, `__title`, `__body`, `__footer` | |
| Field | `.field`, `__label`, `__value`, `__hint`, `__error`; `.input`, `.select`, `.textarea` | `.select` draws its chevron with CSS gradients so it follows the theme. Inputs are at least 16px on mobile so iOS doesn't zoom |
| Choice | `.checkbox`, `.radio-card`, `.slider` | Native controls tinted with `accent-color` |
| Segmented | `.segmented`, `__item` | Used for the theme switch and mode toggles |
| Badge | `.badge` plus `--accent`, `--success`, `--warning`, `--danger`, `--info` | |
| Alert | `.alert` plus status modifiers; `.toast-region` for floating toasts | |
| Dialog | `.dialog` on a native `<dialog>` with `__header`, `__title`, `__body`, `__footer` | Open it with `showModal()` to get a focus trap, Esc to close and an inert background. It becomes a full-screen sheet below 640px |
| Feedback | `.progress`, `__fill`, `.spinner`, `.skeleton` | |
| Misc | `.dropzone`, `.empty-state`, `.checkerboard`, `.kbd`, `.sr-only`, `.skip-link` | |

## Accessibility

The target is WCAG 2.2 AA in both themes.

- **Contrast.** Every token pair was checked: text at least 4.5:1, control boundaries and focus rings at least 3:1.
- **Keyboard.**
  - Every page starts with a skip link.
  - `:focus-visible` shows a 2px accent ring.
  - The theme switch is a `radiogroup` that responds to the arrow keys.
  - Dialogs use native `<dialog>`.
- **User preferences.** `prefers-reduced-motion` turns off animations. `forced-colors` mode keeps component borders visible.

## Do and don't

- **Do** reach for an existing component before writing a new one, and add new shared pieces to `_components.scss` in every repo.
- **Do** test new UI at 320px, 768px and 1280px, in both themes.
- **Don't** add `backdrop-filter`, gradients or glow effects. The only blur allowed is on the sticky header.
- **Don't** use `!important`, except in the reduced-motion and utility rules that already have it.
- **Don't** use colour as the only signal. Pair it with an icon or text, as the status badges do.
