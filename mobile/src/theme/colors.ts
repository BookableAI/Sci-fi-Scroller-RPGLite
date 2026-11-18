/**
 * Sector Sentinel — shared science-fantasy chrome tokens.
 * Hard-sci-fi structure with luminous cyan / violet-teal accents.
 */

export const COLORS = {
  /** Deep void backdrop */
  void: '#070B14',
  /** Soft elevated panel */
  panel: '#141C2E',
  /** Slightly lifted surface (modals, active cells) */
  panelElevated: '#1A2438',
  /** Clean border — less muddy slate */
  border: '#2A3654',
  /** Subtle luminous edge */
  borderGlow: '#3D4F78',
  text: '#F1F5FF',
  muted: '#8B9BB8',
  /** Primary luminous cyan */
  cyan: '#38BDF8',
  /** Violet-teal secondary accent */
  teal: '#2DD4BF',
  violet: '#A78BFA',
  /** Warm status / salvage accent */
  amber: '#FBBF24',
  hull: '#C4D0E0',
  hostile: '#FB7185',
  projectile: '#7DD3FC',
  /** Dim overlays */
  backdrop: 'rgba(7, 11, 20, 0.88)',
} as const;

export type ThemeColor = keyof typeof COLORS;

/** Soft panel corner radius for science-fantasy chrome */
export const RADII = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const FONTS = {
  mono: 'Courier',
} as const;
