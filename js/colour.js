// Colour arithmetic: hex <-> RGB <-> HSL, hue/vivid adjustment, WCAG contrast grades,
// and Gaussian stack blend for procedural forms.
import { S } from "./state.js";

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v) => clamp(v, 0, 1);
export const TAU = Math.PI * 2;

/** A repeatable pseudo-random number in [0, 1) for a seed and an index. */
export function rnd(seed, i) {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

export function toRgb(hex) {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(r, g, b) {
    return `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

export function rgba(hex, a) {
    const [r, g, b] = toRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}

function hueOf(r, g, b, max, d) {
    if (max === r)
        return (g - b) / d + (g < b ? 6 : 0);
    if (max === g)
        return (b - r) / d + 2;
    return (r - g) / d + 4;
}

export function rgbToHsl(r255, g255, b255) {
    const r = r255 / 255;
    const g = g255 / 255;
    const b = b255 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    return [hueOf(r, g, b, max, d) * 60, s, l];
}

export function hslToRgb(hue, s, l) {
    const h = ((hue % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
}

/** A stop's colour after Hue and Vivid sliders. */
export function adjust(hex) {
    if (!S.hue && S.vivid === 50)
        return hex;
    const [h, s, l] = rgbToHsl(...toRgb(hex));
    return toHex(...hslToRgb(h + S.hue, clamp01(s * (0.35 + (1.3 * S.vivid) / 100)), l));
}

/** The stops as drawn: adjusted, in position order. */
export function drawnStops() {
    return S.stops.map((s) => ({ c: adjust(s.c), p: s.p })).sort((a, b) => a.p - b.p);
}

/** The stops as listed in the panel. */
export const listedStops = () => S.stops.map((s) => ({ c: adjust(s.c), p: s.p }));

function luminance(hex) {
    const [r, g, b] = toRgb(hex).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function gradeOf(contrast) {
    if (contrast >= 7)
        return "AAA";
    if (contrast >= 4.5)
        return "AA";
    if (contrast >= 3)
        return "AA·L";
    return "low";
}

/** The best WCAG grade text can get on this colour. */
export function rating(hex) {
    const lum = luminance(hex);
    const onWhite = 1.05 / (lum + 0.05);
    const onBlack = (lum + 0.05) / 0.05;
    const best = Math.max(onWhite, onBlack);
    return { grade: gradeOf(best), text: onWhite >= onBlack ? "white" : "black", ratio: best.toFixed(1) };
}

export const paletteOf = (stops) => ({ rgb: stops.map((s) => toRgb(s.c)), pos: stops.map((s) => s.p / 100) });

/**
 * Colour at `t` (0..1) along the stops, weighted by Gaussians around each position.
 */
export function mixStack(pal, t, blend, out) {
    const n = pal.rgb.length;
    const x = clamp01(t) * (n - 1);
    const sigma = 0.2 + 1.7 * blend ** 1.1;
    let total = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
        const d = (x - pal.pos[i] * (n - 1)) / sigma;
        const w = Math.exp(-d * d);
        total += w;
        r += pal.rgb[i][0] * w;
        g += pal.rgb[i][1] * w;
        b += pal.rgb[i][2] * w;
    }
    out[0] = r / total;
    out[1] = g / total;
    out[2] = b / total;
}

export const stackAt = (pal, t, out) => mixStack(pal, t, S.blend / 100, out);
