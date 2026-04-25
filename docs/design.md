# TimesheetPlus Design Baseline

Snapshot date: 2026-04-25

## Theme Direction
- Light-first UI with subtle gradients and soft surfaces.
- Utility-focused layout prioritizing readability over heavy ornamentation.

## Color Tokens (from global CSS)
- `--bg`: `#f8f9fa`
- `--ink`: `#1f2a44`
- `--surface`: `#ffffff`
- `--brand`: `#0052cc`
- `--accent`: `#1a6fe8`
- `--muted`: `#5f6f8f`
- `--ring`: `#0052cc`

## Typography
- Body font: `Inter` (`--font-body`)
- Heading font: `Manrope` (`--font-heading`)

## Visual Language
- Rounded cards and controls (`rounded-xl` / `rounded-2xl` patterns).
- Soft shadows for layered surfaces.
- Blue-centric call-to-action styling for primary actions.

## Motion
- Lightweight page entrance animation (`page-enter`, 320ms ease-out).
- No heavy motion dependencies; interactions favor clarity and responsiveness.

## Component Principles
- Keep table and modal content scannable.
- Use explicit labels for actions with permission implications (delete, remove, reject).
- Prefer modal-scoped scrolling for dense detail views instead of page-level scroll lock.
