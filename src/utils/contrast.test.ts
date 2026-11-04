import { describe, it, expect } from 'vitest';

/**
 * Calculates relative luminance for an sRGB color according to WCAG 2.2 specifications.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(hex: string): number {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 * Value ranges from 1:1 to 21:1.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG 2.2 Contrast Ratio Verification', () => {
  // Morning Theme Palette Tokens
  const morningTheme = {
    bgSky: '#E2EEF8',
    bgPanel: '#FFFFFF',
    bgSurface: '#F8FAFC',
    textPrimary: '#0F172A',     // Slate 900
    textSecondary: '#334155',   // Slate 700
    textMuted: '#64748B',       // Slate 500
    actionPrimary: '#2563EB',   // Royal Blue
    actionPrimaryText: '#FFFFFF',
    statusSuccess: '#15803D',
    statusError: '#DC2626'
  };

  // Night Theme Palette Tokens
  const nightTheme = {
    bgSky: '#0B0F19',
    bgPanel: '#111827',         // Slate 900 panel
    bgSurface: '#1E293B',       // Slate 800 surface
    textPrimary: '#F8FAFC',     // Slate 50
    textSecondary: '#CBD5E1',   // Slate 300
    textMuted: '#94A3B8',       // Slate 400
    actionPrimary: '#2563EB',   // Royal Blue (5.2:1 with white text)
    actionPrimaryText: '#FFFFFF',
    statusSuccess: '#34D399',
    statusError: '#F87171'
  };

  describe('Morning Theme (Light Mode) Contrast Standards', () => {
    it('achieves WCAG AAA (>= 7:1) for primary text on panel background', () => {
      const ratio = getContrastRatio(morningTheme.textPrimary, morningTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('achieves WCAG AA (>= 4.5:1) for secondary text on panel background', () => {
      const ratio = getContrastRatio(morningTheme.textSecondary, morningTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('achieves WCAG AA (>= 4.5:1) for muted text on panel background', () => {
      const ratio = getContrastRatio(morningTheme.textMuted, morningTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('achieves WCAG AA (>= 4.5:1) for primary action button label against button fill', () => {
      const ratio = getContrastRatio(morningTheme.actionPrimaryText, morningTheme.actionPrimary);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('achieves WCAG AA (>= 4.5:1) for status colors on white background', () => {
      const successRatio = getContrastRatio(morningTheme.statusSuccess, morningTheme.bgPanel);
      const errorRatio = getContrastRatio(morningTheme.statusError, morningTheme.bgPanel);
      expect(successRatio).toBeGreaterThanOrEqual(4.5);
      expect(errorRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Night Theme (Dark Mode) Contrast Standards', () => {
    it('achieves WCAG AAA (>= 7:1) for primary text on panel background', () => {
      const ratio = getContrastRatio(nightTheme.textPrimary, nightTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('achieves WCAG AAA (>= 7:1) for secondary text on panel background', () => {
      const ratio = getContrastRatio(nightTheme.textSecondary, nightTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('achieves WCAG AA (>= 4.5:1) for muted text on panel background', () => {
      const ratio = getContrastRatio(nightTheme.textMuted, nightTheme.bgPanel);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('achieves WCAG AA (>= 4.5:1) for primary action button label against button fill', () => {
      const ratio = getContrastRatio(nightTheme.actionPrimaryText, nightTheme.actionPrimary);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('achieves WCAG AA (>= 4.5:1) for status colors on night panel background', () => {
      const successRatio = getContrastRatio(nightTheme.statusSuccess, nightTheme.bgPanel);
      const errorRatio = getContrastRatio(nightTheme.statusError, nightTheme.bgPanel);
      expect(successRatio).toBeGreaterThanOrEqual(4.5);
      expect(errorRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Unreadable and Invalid Combinations Detection', () => {
    it('detects unreadable low-contrast combinations (< 3:1)', () => {
      // Light gray on white fails both normal and large text thresholds
      const badRatio = getContrastRatio('#CCCCCC', '#FFFFFF');
      expect(badRatio).toBeLessThan(3.0);
    });

    it('correctly satisfies large text threshold (>= 3:1)', () => {
      // Large text requirement
      const largeTextRatio = getContrastRatio('#707070', '#FFFFFF');
      expect(largeTextRatio).toBeGreaterThanOrEqual(3.0);
    });
  });
});
