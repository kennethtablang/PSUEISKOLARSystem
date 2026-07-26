/**
 * Chart tokens for the analytics/dashboard visualisations.
 *
 * The categorical order below is fixed and was validated with the dataviz
 * palette validator against this app's own card surfaces — light `#e8edf5`,
 * dark `#18222f` — rather than eyeballed:
 *
 *   light: lightness band PASS · chroma floor PASS · worst adjacent CVD ΔE 9.1
 *          (protan) · worst adjacent normal-vision ΔE 19.6
 *   dark:  lightness band PASS · chroma floor PASS · worst adjacent CVD ΔE 8.4
 *          (protan) · worst adjacent normal-vision ΔE 19.3 · contrast all ≥ 3:1
 *
 * Four light-mode steps sit below 3:1 against the light card, so every chart
 * using them ships a legend **and** a table of the same numbers — that relief is
 * required, not optional. Dark steps are their own selected values, not a flip.
 *
 * IMPORTANT — those numbers hold for the *adjacent* pairlist only (stacked bars,
 * grouped bars, lines), where a reader compares neighbours. Forms where every
 * series is compared against every other — scatter, bubble, pie/donut wedges —
 * need the all-pairs check, and six slots FAIL it (green↔orange ΔE 3.2 protan;
 * magenta↔orange ΔE 12.9 normal-vision, under the 15 floor). Only the first
 * three slots clear all-pairs. Past three in such a form, fold the tail into
 * "Other", facet into small multiples, or pick a form that doesn't lean on hue.
 *
 * Rules that matter when editing this file:
 *  - Assign slots in order and never cycle. A 7th category folds into "Other".
 *  - Colour follows the entity, never its rank — don't sort-then-colour.
 *  - A single-series chart uses one colour (`markColor`) for every bar; a ramp
 *    across nominal categories double-encodes bar length and tells the reader
 *    nothing new.
 */

const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
};

// Reserved for state, never for "series N". Verified reads good, Pending
// warning, Incomplete serious — each always paired with a written label.
const STATUS = {
  verified:   '#10a060',
  pending:    '#f5b800',
  incomplete: '#f07030',
};

const CHROME = {
  light: {
    grid: 'rgba(0,0,48,0.06)',
    axis: '#7a8aaa',
    tooltipBg: '#f0f4fa',
    tooltipBorder: '1.5px solid rgba(0,48,135,0.12)',
    tooltipText: '#0d1a33',
    cursor: 'rgba(0,48,135,0.05)',
    markColor: '#003087',
    // A 2px surface gap between stacked segments and adjacent bars.
    gap: '#e8edf5',
  },
  dark: {
    grid: 'rgba(255,255,255,0.07)',
    axis: '#8896aa',
    tooltipBg: '#1c2735',
    tooltipBorder: '1.5px solid rgba(255,255,255,0.12)',
    tooltipText: '#eaf0f8',
    cursor: 'rgba(255,255,255,0.05)',
    markColor: '#5b93e8',
    gap: '#18222f',
  },
};

/** All chart tokens for a resolved theme ('light' | 'dark'). */
export function vizTokens(mode) {
  const m = mode === 'dark' ? 'dark' : 'light';
  return { ...CHROME[m], series: CATEGORICAL[m], status: STATUS, mode: m };
}

/** Categorical colour for slot `i`, folding anything past the palette into the last slot. */
export function seriesColor(series, i) {
  return series[Math.min(i, series.length - 1)];
}

/** Recharts tooltip chrome for a resolved theme. */
export function tooltipStyle(t) {
  return {
    borderRadius: 12,
    border: t.tooltipBorder,
    background: t.tooltipBg,
    color: t.tooltipText,
    boxShadow: '3px 3px 0 rgba(0,0,48,0.10)',
    fontSize: 12,
  };
}
