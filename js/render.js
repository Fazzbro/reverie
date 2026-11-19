// The thirteen gradient forms and post-passes: fluted glass, grain noise, photo underlay, label text.
import { TAU, clamp01, drawnStops, mixStack, paletteOf, rgba, rnd, stackAt, toHex, toRgb } from "./colour.js";
import { S, random } from "./state.js";

export function context2d(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("This browser cannot draw on a canvas.");
    return ctx;
}

function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}

const smooth = (ctx) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
};

const blurOn = (ctx, px) => {
    if ("filter" in ctx)
        ctx.filter = px > 0.3 ? `blur(${px}px)` : "none";
};

/** Wobble that only moves while Animate is on. */
const moving = (v) => (S.motion ? v : 0);

function smoothstep(a, b, x) {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
}

// Grain: single precomputed noise tile
const NOISE = makeCanvas(256, 256);
{
    const ctx = context2d(NOISE);
    const tile = ctx.createImageData(256, 256);
    const values = crypto.getRandomValues(new Uint8Array(256 * 256));
    values.forEach((v, i) => {
        tile.data.set([v, v, v, 255], i * 4);
    });
    ctx.putImageData(tile, 0, 0);
}

// Per-pixel forms: computed at intermediate field resolution and scaled smoothly
const buffers = new Map();
function bufferFor(bw, bh) {
    const key = `${bw}x${bh}`;
    let found = buffers.get(key);
    if (!found) {
        if (buffers.size > 8)
            buffers.clear();
        const ctx = context2d(makeCanvas(bw, bh));
        found = { ctx, img: ctx.createImageData(bw, bh) };
        buffers.set(key, found);
    }
    return found;
}

function renderField(ctx, w, h, maxRes, fn) {
    const sc = Math.min(1, maxRes / Math.max(w, h));
    const bw = Math.max(2, Math.round(w * sc));
    const bh = Math.max(2, Math.round(h * sc));
    const buf = bufferFor(bw, bh);
    const d = buf.img.data;
    const out = [0, 0, 0];
    const aspect = bw / bh;
    for (let j = 0; j < bh; j++) {
        const v = (j + 0.5) / bh;
        for (let i = 0; i < bw; i++) {
            fn((i + 0.5) / bw, v, aspect, out);
            const p = (j * bw + i) * 4;
            d[p] = out[0];
            d[p + 1] = out[1];
            d[p + 2] = out[2];
            d[p + 3] = 255;
        }
    }
    buf.ctx.putImageData(buf.img, 0, 0);
    smooth(ctx);
    ctx.drawImage(buf.ctx.canvas, 0, 0, w, h);
}

const MELT_DRIFT = { left: -1, right: 1, up: 0.35, down: 0.35 };

const renderMelt = (ctx, w, h, k, cols) => {
    const pal = paletteOf(cols);
    const n = cols.length;
    const melt = S.melt / 100;
    const peaks = S.peaks / 100;
    const glow = S.glow / 100;
    const scale = 0.6 + (S.scale / 100) * 2.4;
    const [f1, f2, f3] = [2.2 * scale, 4.1 * scale, 7.3 * scale];
    const a = (S.tilt * Math.PI) / 180;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const drift = MELT_DRIFT[S.dir] ?? 1;
    const vertical = S.dir === "up" || S.dir === "down";
    const sp = S.seed * 2.3;
    const ph1 = sp + k * 0.8 * drift;
    const ph2 = sp * 1.7 + k * 0.55 * drift;
    const turn = S.dir === "up" ? 0 : Math.PI;
    const bob = vertical ? 0.12 * Math.sin(k * 0.9 + turn) : 0.03 * Math.sin(k * 0.5);
    const shift = (S.rise / 100 - 0.5) * 0.9;
    const blend = S.blend / 100;
    renderField(ctx, w, h, 340, (u, v, aspect, out) => {
        const x = (u - 0.5) * aspect;
        const yy = 0.5 - v;
        const xr = x * ca - yy * sa;
        const yr = x * sa + yy * ca;
        const xw = xr + 0.18 * melt * Math.sin(yr * 3.2 * scale + ph2);
        let wave = 0.5 * Math.sin(xw * f1 + ph1) + 0.3 * Math.sin(xw * f2 + ph2 + 1.7) + 0.2 * Math.sin(xw * f3 - ph1 * 0.7 + 0.4);
        const bump = Math.max(0, Math.sin(xw * f2 * 0.8 + ph1 + 2.1)) ** 4;
        wave = wave * (1 - 0.35 * peaks) + peaks * 1.1 * (bump - 0.3);
        const s = yr + 0.5 - shift + bob + melt * 0.5 * wave;
        const tt = clamp01(s) * (n - 1);
        const f = tt - Math.floor(tt);
        mixStack(pal, s, blend, out);
        const lift = glow * 0.22 * (1 - Math.abs(2 * f - 1));
        for (let c = 0; c < 3; c++)
            out[c] += (255 - out[c]) * lift;
    });
};

const renderSilk = (ctx, w, h, k, cols) => {
    const pal = paletteOf(cols);
    const a = (S.sang * Math.PI) / 180;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const fr = 0.8 + S.folds * 0.45;
    const warp = (S.twist / 100) * 0.9;
    const ph = S.seed * 1.7;
    renderField(ctx, w, h, 300, (u, v, aspect, out) => {
        const x = (u - 0.5) * aspect;
        const y = v - 0.5;
        const xr = x * ca + y * sa;
        const yr = -x * sa + y * ca;
        const w1 = xr + warp * 0.5 * Math.sin(yr * fr * 1.3 + k * 0.4 + ph);
        const f = 0.55 * Math.sin(w1 * fr * 2.1 + ph + k * 0.3) +
            0.3 * Math.sin((w1 + yr * 0.5 * warp) * fr * 3.4 - ph * 1.3 - k * 0.25) +
            0.15 * Math.sin(yr * fr * 2.7 + ph * 0.7 + k * 0.2);
        const tt = (0.5 + 0.5 * f) ** 1.15;
        stackAt(pal, 0.62 * tt + 0.38 * ((xr / aspect) * 0.9 + 0.5), out);
    });
};

const renderBeams = (ctx, w, h, k, cols) => {
    const halfWidth = 0.1 + (0.8 * S.blend) / 100;
    const pal = paletteOf(cols);
    const f = Math.max(2, Math.round(S.rays * 1.8));
    const f2 = Math.round(f * 2.3);
    const f3 = Math.round(f * 3.7);
    const decay = 2.6 / (S.rreach / 100);
    const m = S.motion ? 1 : 0;
    const p1 = S.seed * 3 + m * k * 0.25;
    const p2 = S.seed * 5.1 - m * k * 0.18;
    const p3 = S.seed * 7.3 + m * k * 0.12;
    const sy = (S.srcy / 100) * 1.08 - 0.08;
    renderField(ctx, w, h, 300, (u, v, aspect, out) => {
        const dx = (u - 0.5) * aspect - (S.srcx / 100 - 0.5) * aspect;
        const dy = v - sy;
        const dist = Math.hypot(dx, dy);
        const th = Math.atan2(dx, dy);
        const it = 0.55 * Math.sin(th * f + p1) + 0.3 * Math.sin(th * f2 + p2) + 0.15 * Math.sin(th * f3 + p3);
        const ray = smoothstep(0.2 - halfWidth, 0.2 + halfWidth + 0.45, it);
        const fall = Math.exp(-dist * decay);
        const light = Math.min(1, ray * fall * 1.2 + Math.exp(-dist * 6) * 0.5 + 0.06 * fall);
        mixStack(pal, 1 - light, 0.55, out);
    });
};

const renderGlow = (ctx, w, h, k, cols) => {
    const pal = paletteOf(cols);
    const a = (S.gang * Math.PI) / 180;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const warp = S.gwarp / 100;
    const spots = S.gspot / 100;
    const ph = S.seed * 1.7;
    const blobs = [0, 1, 2].map((j) => ({
        x: (rnd(S.seed, j * 5 + 1) - 0.5) * 0.9,
        y: (rnd(S.seed, j * 5 + 2) - 0.5) * 0.9,
        r: 0.18 + 0.16 * rnd(S.seed, j * 5 + 3),
        sign: j === 1 ? -1 : 1,
        drift: 0.06 * Math.sin(k * 0.3 + j),
    }));
    renderField(ctx, w, h, 300, (u, v, aspect, out) => {
        const x = (u - 0.5) * aspect;
        const y = v - 0.5;
        const wx = x + warp * (0.3 * Math.sin(y * 2.1 + ph + k * 0.22) + 0.12 * Math.sin(y * 4.3 + ph * 1.7 - k * 0.3));
        const wy = y + warp * (0.26 * Math.sin(x * 1.8 + ph * 0.8 + k * 0.19) + 0.1 * Math.sin(x * 3.9 - ph - k * 0.25));
        let t = 0.5 + (wx * ca + wy * sa) * 0.85;
        for (const b of blobs) {
            const dx = wx - b.x - b.drift;
            const dy = wy - b.y;
            t -= b.sign * spots * 0.55 * Math.exp(-(dx * dx + dy * dy) / (b.r * b.r));
        }
        stackAt(pal, t, out);
    });
};

const renderRipple = (ctx, w, h, k, cols) => {
    const pal = paletteOf(cols);
    const warp = S.rwarp / 100;
    const cx = S.rcx / 100 - 0.5;
    const cy = S.rcy / 100;
    renderField(ctx, w, h, 340, (u, v, aspect, out) => {
        const x = (u - 0.5) * aspect - cx * aspect;
        const y = v - cy;
        const ang = Math.atan2(y, x);
        const d = Math.hypot(x, y) *
            (1 + warp * 0.12 * Math.sin(ang * 2 + S.seed + k * 0.35) + warp * 0.05 * Math.sin(ang * 3 - k * 0.3 + S.seed * 2));
        const swell = 0.5 + 0.5 * Math.sin(d * S.rrings * TAU - k * 0.9);
        const fall = Math.min(1, d * 1.05);
        stackAt(pal, clamp01(fall + (swell - 0.5) * 0.3 * (1 - fall * 0.35)), out);
    });
};

const renderRibbons = (ctx, w, h, k, cols) => {
    const pal = paletteOf(cols);
    const count = cols.length - 1;
    const amp = S.ramp / 100;
    const width = S.rwid / 100;
    const a = (S.rtilt * Math.PI) / 180;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    const power = 1.6 + (1 - S.rsoft / 100) * 5;
    const bg = pal.rgb[count];
    const ribbons = Array.from({ length: count }, (_, i) => ({
        i,
        colour: pal.rgb[count - 1 - i],
        t: count > 1 ? i / (count - 1) : 0.5,
        ph: rnd(S.seed, i * 3 + 1) * TAU,
        ph2: rnd(S.seed, i * 3 + 2) * TAU,
    }));
    renderField(ctx, w, h, 360, (u, v, aspect, out) => {
        const x0 = (u - 0.5) * aspect;
        const y0 = v - 0.5;
        const x = x0 * ca - y0 * sa;
        const y = x0 * sa + y0 * ca;
        const px = [bg[0], bg[1], bg[2]];
        for (const rb of ribbons) {
            const centre = (rb.t - 0.5) * 0.85 +
                amp * 0.3 * (Math.sin(x * 2.1 + rb.ph + k * (0.35 + 0.08 * rb.i)) * 0.65 + Math.sin(x * 4.3 + rb.ph2 - k * 0.3) * 0.35);
            const thick = (0.07 + 0.2 * width) * (0.75 + 0.35 * Math.sin(x * 2.7 + rb.ph2 + k * 0.2));
            const d = Math.abs((y - centre) / thick);
            const cover = Math.exp(-(d ** power));
            if (cover < 0.004)
                continue;
            const shine = 0.26 * (1 - Math.min(1, d));
            const alpha = cover * 0.95;
            for (let c = 0; c < 3; c++)
                px[c] += (rb.colour[c] + (255 - rb.colour[c]) * shine - px[c]) * alpha;
        }
        out[0] = px[0];
        out[1] = px[1];
        out[2] = px[2];
    });
};

const renderTide = (ctx, w, h, k, cols) => {
    const n = cols.length;
    const layers = n - 1;
    const amp = (S.amp / 100) * h * 0.22;
    const soft = (S.soft / 100) * h * 0.07;
    const pad = Math.max(w * 0.1, soft * 3);
    const steps = 90;
    ctx.fillStyle = cols[n - 1].c;
    ctx.fillRect(0, 0, w, h);
    blurOn(ctx, soft);
    for (let j = 0; j < layers; j++) {
        const ci = n - 2 - j;
        const level = h * (0.16 + (0.74 * j) / layers);
        const ph = rnd(S.seed, j) * TAU;
        const ph2 = rnd(S.seed, j + 9) * TAU;
        ctx.beginPath();
        ctx.moveTo(-pad, h + pad);
        for (let i = 0; i <= steps; i++) {
            const x = -pad + ((w + pad * 2) * i) / steps;
            const u = x / w;
            const y = level + amp * (Math.sin(u * S.freq * TAU + ph + k * (0.55 + 0.15 * j)) * 0.6 + Math.sin(u * S.freq * 13.5 + ph2 - k * 0.45) * 0.4);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w + pad, h + pad);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, level - amp, 0, level + h * 0.4);
        g.addColorStop(0, cols[ci].c);
        g.addColorStop(1, cols[Math.max(0, ci - 1)].c);
        ctx.fillStyle = g;
        ctx.fill();
    }
    blurOn(ctx, 0);
};

const renderHalo = (ctx, w, h, k, cols) => {
    const n = cols.length;
    const radius = Math.max(w, h) * (S.hsize / 100) * 0.75;
    const soft = (S.soft / 100) * Math.min(w, h) * 0.3;
    const squash = S.squash / 100;
    const cx = w * 0.5 + moving(w * 0.06 * Math.sin(k * 0.5));
    const cy = (h * S.posy) / 100 + moving(h * 0.05 * Math.cos(k * 0.4));
    ctx.fillStyle = cols[n - 1].c;
    ctx.fillRect(0, 0, w, h);
    blurOn(ctx, soft);
    for (let j = 0; j < n - 1; j++) {
        const r = radius * (1 - j / (n - 1)) * (1 + 0.04 * Math.sin(k * 0.8 + j));
        ctx.fillStyle = cols[n - 2 - j].c;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * squash, 0, 0, TAU);
        ctx.fill();
    }
    blurOn(ctx, 0);
};

const renderHorizon = (ctx, w, h, k, cols) => {
    const n = cols.length;
    const cx = w * (0.5 + moving(0.07 * Math.sin(k * 0.45)));
    const cy = h * (1 - (S.horizon / 100) * 0.5);
    const rx = w * (S.spread / 100) * 0.8 * (1 + moving(0.04 * Math.sin(k * 0.7)));
    const sy = Math.max(0.05, (h * S.reach) / 100 / rx);
    const bulb = Math.min(w, h) * (S.sun / 100) * (1 + moving(0.08 * Math.sin(k * 1.1)));
    const half = (((1 - S.hblend / 100) * 0.5) / (n - 1)) * 0.95;
    ctx.fillStyle = cols[n - 1].c;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    cols.forEach((c, i) => {
        const t = i / (n - 1);
        g.addColorStop(clamp01(t - half), c.c);
        g.addColorStop(clamp01(t + half), c.c);
    });
    ctx.fillStyle = g;
    ctx.fillRect(-rx * 3, -rx * 3, rx * 6, rx * 6);
    ctx.restore();
    const light = toHex(...toRgb(cols[0].c).map((v) => v + (255 - v) * 0.7));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, bulb * 4.5);
    haze.addColorStop(0, rgba(light, 0.95));
    haze.addColorStop(0.25, rgba(cols[0].c, 0.55));
    haze.addColorStop(1, rgba(cols[0].c, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    blurOn(ctx, bulb * 0.12);
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(cx, cy, bulb * 0.55, 0, TAU);
    ctx.fill();
    blurOn(ctx, 0);
};

const renderLinear = (ctx, w, h, k, cols) => {
    const a = ((S.angle + moving(k * 18)) * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const g = ctx.createLinearGradient(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2, w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2);
    for (const s of cols)
        g.addColorStop(s.p / 100, s.c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
};

const renderRadial = (ctx, w, h, k, cols) => {
    const cx = w * (0.5 + moving(0.2 * Math.cos(k * 0.5)));
    const cy = h * (0.5 + moving(0.2 * Math.sin(k * 0.5)));
    const r = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const s of cols)
        g.addColorStop(s.p / 100, s.c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
};

const renderConic = (ctx, w, h, k, cols) => {
    const g = ctx.createConicGradient(((S.angle - 90 + moving(k * 18)) * Math.PI) / 180, w / 2, h / 2);
    for (const s of cols)
        g.addColorStop(s.p / 100, s.c);
    g.addColorStop(1, cols[0].c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
};

function blob(i, t) {
    const x = 0.12 + 0.76 * rnd(S.seed, i * 2 + 1);
    const y = 0.12 + 0.76 * rnd(S.seed, i * 2 + 2);
    return [x + 0.09 * Math.sin(t * 0.55 + i * 1.9), y + 0.09 * Math.cos(t * 0.45 + i * 2.3)];
}

const renderMesh = (ctx, w, h, k, cols) => {
    ctx.fillStyle = cols[0].c;
    ctx.fillRect(0, 0, w, h);
    const r = Math.max(w, h) * (S.size / 100) * 0.7;
    cols.forEach((s, i) => {
        const [x, y] = blob(i, k);
        const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
        g.addColorStop(0, rgba(s.c, 1));
        g.addColorStop(0.5, rgba(s.c, 0.55));
        g.addColorStop(1, rgba(s.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    });
};

const RENDERERS = {
    melt: renderMelt,
    mesh: renderMesh,
    silk: renderSilk,
    beams: renderBeams,
    glow: renderGlow,
    ripple: renderRipple,
    ribbons: renderRibbons,
    tide: renderTide,
    halo: renderHalo,
    horizon: renderHorizon,
    linear: renderLinear,
    radial: renderRadial,
    conic: renderConic,
};

let glassCopy = null;
function glassPass(ctx, w, h) {
    const bars = S.gbars;
    const bw = w / bars;
    const slices = 6;
    const amount = S.glass / 100;
    const gloss = S.gloss / 100;
    if (glassCopy?.canvas.width !== w || glassCopy.canvas.height !== h)
        glassCopy = context2d(makeCanvas(w, h));
    glassCopy.clearRect(0, 0, w, h);
    glassCopy.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    smooth(ctx);
    const sliceWidth = Math.max(1, (bw / slices) * (1 - amount * 0.9));
    for (let i = 0; i < bars; i++) {
        const x = i * bw;
        for (let j = 0; j < slices; j++) {
            const u = (j + 0.5) / slices - 0.5;
            const srcx = x + bw / 2 + u * bw * (1 - amount * 0.9) - amount * bw * 0.22 * Math.sin(TAU * u);
            ctx.drawImage(glassCopy.canvas, srcx - sliceWidth / 2, 0, sliceWidth, h, x + (j * bw) / slices, 0, bw / slices + 0.7, h);
        }
        const g = ctx.createLinearGradient(x, 0, x + bw, 0);
        g.addColorStop(0, `rgba(255,255,255,${0.3 * gloss})`);
        g.addColorStop(0.14, `rgba(255,255,255,${0.07 * gloss})`);
        g.addColorStop(0.5, "rgba(255,255,255,0)");
        g.addColorStop(0.86, `rgba(0,0,0,${0.07 * gloss})`);
        g.addColorStop(1, `rgba(0,0,0,${0.3 * gloss})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, bw, h);
        ctx.fillStyle = `rgba(255,255,255,${0.38 * gloss})`;
        ctx.fillRect(x, 0, Math.max(1, bw * 0.025), h);
    }
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, `rgba(255,255,255,${0.2 * gloss})`);
    sheen.addColorStop(0.45, "rgba(255,255,255,0)");
    sheen.addColorStop(1, `rgba(255,255,255,${0.07 * gloss})`);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function grainPass(ctx, w, h) {
    const pattern = ctx.createPattern(NOISE, "repeat");
    if (!pattern)
        return;
    ctx.save();
    const sc = S.gsize * Math.max(1, w / 1000);
    const jx = moving(random() * 256);
    const jy = moving(random() * 256);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = (S.grain / 100) * 0.7;
    ctx.scale(sc, sc);
    ctx.translate(-jx, -jy);
    ctx.fillStyle = pattern;
    ctx.fillRect(jx, jy, w / sc, h / sc);
    ctx.restore();
}

function finishPass(ctx, w, h) {
    if (S.glass > 0)
        glassPass(ctx, w, h);
    if (S.grain > 0)
        grainPass(ctx, w, h);
}

export function renderGradient(ctx, w, h, k, post = true) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    RENDERERS[S.type](ctx, w, h, k, drawnStops());
    if (post)
        finishPass(ctx, w, h);
    ctx.restore();
}

function drawImageLayer(ctx, w, h, im) {
    const iw = im.naturalWidth;
    const ih = im.naturalHeight;
    const blur = (S.iblur / 100) * Math.min(w, h) * 0.06;
    let sc = Math.max(w / iw, h / ih) * (S.iscale / 100);
    sc *= 1 + (blur * 3) / Math.min(iw * sc, ih * sc);
    const dw = iw * sc;
    const dh = ih * sc;
    const x = dw > w ? -(dw - w) * (S.ix / 100) : (w - dw) / 2;
    const y = dh > h ? -(dh - h) * (S.iy / 100) : (h - dh) / 2;
    ctx.save();
    if ("filter" in ctx) {
        ctx.filter = `blur(${blur}px) brightness(${S.ibright}%) contrast(${S.icont}%) saturate(${S.isat}%)`;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, x, y, dw, dh);
    ctx.restore();
}

export const LABEL_FONTS = {
    geist: { family: "Geist", weight: 600, tracking: -0.035, size: 1, style: "normal" },
    mono: { family: "Geist Mono", weight: 500, tracking: -0.04, size: 0.82, style: "normal" },
    serif: { family: "Instrument Serif", weight: 400, tracking: -0.02, size: 1.2, style: "italic" },
};

export const fontSpec = (font, px) => {
    const f = LABEL_FONTS[font];
    return `${f.style} ${f.weight} ${px}px "${f.family}", serif`;
};

function wrap(ctx, text, maxWidth) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        }
        else {
            line = next;
        }
    }
    if (line)
        lines.push(line);
    return lines;
}

function drawLabel(ctx, w, h, previewWidth) {
    if (S.text === "off" || !S.label)
        return;
    const font = LABEL_FONTS[S.font];
    const px = S.tsize * font.size * (w / (previewWidth || w));
    ctx.save();
    ctx.font = fontSpec(S.font, px);
    if ("letterSpacing" in ctx)
        ctx.letterSpacing = `${font.tracking * px}px`;
    ctx.fillStyle = S.text === "dark" ? "#111" : "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrap(ctx, S.label, w * 0.84);
    const lineHeight = px * 1.05;
    const top = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * lineHeight));
    ctx.restore();
}

function fadeLine(fade, w, h) {
    switch (fade) {
        case "bottom":
            return [0, h, 0, 0];
        case "top":
            return [0, 0, 0, h];
        case "left":
            return [0, 0, w, 0];
        default:
            return [w, 0, 0, 0];
    }
}

let overlay = null;
function drawOverlay(ctx, w, h, k) {
    if (overlay?.canvas.width !== w || overlay.canvas.height !== h)
        overlay = context2d(makeCanvas(w, h));
    renderGradient(overlay, w, h, k, false);
    if (S.fade !== "none") {
        const [x0, y0, x1, y1] = fadeLine(S.fade, w, h);
        const mask = overlay.createLinearGradient(x0, y0, x1, y1);
        mask.addColorStop(0, "rgba(0,0,0,1)");
        mask.addColorStop(0.5, "rgba(0,0,0,.6)");
        mask.addColorStop(1, "rgba(0,0,0,0)");
        overlay.save();
        overlay.globalCompositeOperation = "destination-in";
        overlay.fillStyle = mask;
        overlay.fillRect(0, 0, w, h);
        overlay.restore();
    }
    ctx.save();
    ctx.globalAlpha = S.gopac / 100;
    ctx.globalCompositeOperation = S.bmode;
    ctx.drawImage(overlay.canvas, 0, 0);
    ctx.restore();
}

export function render(ctx, w, h, k, previewWidth) {
    if (!S.img) {
        renderGradient(ctx, w, h, k, true);
        drawLabel(ctx, w, h, previewWidth);
        return;
    }
    ctx.clearRect(0, 0, w, h);
    drawImageLayer(ctx, w, h, S.img);
    if (S.gopac > 0)
        drawOverlay(ctx, w, h, k);
    finishPass(ctx, w, h);
    drawLabel(ctx, w, h, previewWidth);
}
