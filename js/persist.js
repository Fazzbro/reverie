// Persistence helper: saves/restores state safely.
import { BLEND_MODES } from "./controls.js";
import { FORMS, RATIOS, S } from "./state.js";

const KEY = "devault.gradients.return.v1";
const HEX = /^#[0-9a-f]{6}$/i;

const CHOICES = {
    type: FORMS.map((f) => f.id),
    dir: ["up", "right", "down", "left"],
    text: ["off", "light", "dark"],
    font: ["geist", "mono", "serif"],
    fade: ["none", "bottom", "top", "left", "right"],
    tab: ["design", "image"],
    bmode: BLEND_MODES.map((m) => m.value),
    ratio: [...RATIOS.map((r) => r.id), "custom"],
};

function acceptable(key, value) {
    if (typeof value !== typeof S[key])
        return false;
    if (typeof value === "number")
        return Number.isFinite(value);
    if (typeof value !== "string")
        return true;
    if (key === "label")
        return value.length <= 40;
    return CHOICES[key]?.includes(value) ?? false;
}

export function saveForReturn() {
    try {
        const settings = Object.fromEntries(Object.entries(S).filter(([key]) => key !== "img" && key !== "imgName"));
        sessionStorage.setItem(KEY, JSON.stringify(settings));
    }
    catch {}
}

const validStop = (s) => {
    const stop = s;
    return typeof stop?.c === "string" && HEX.test(stop.c) && typeof stop.p === "number" && stop.p >= 0 && stop.p <= 100;
};

export function restoreAfterReturn() {
    let saved = null;
    try {
        const raw = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        saved = raw ? JSON.parse(raw) : null;
    }
    catch {
        return false;
    }
    if (!saved || typeof saved !== "object")
        return false;
    const target = S;
    for (const key of Object.keys(S)) {
        const value = saved[key];
        if (key === "img" || key === "imgName" || value === undefined)
            continue;
        if (key === "stops") {
            if (Array.isArray(value) && value.length >= 2 && value.length <= 8 && value.every(validStop)) {
                S.stops = value.map((s) => ({ c: s.c.toLowerCase(), p: s.p }));
            }
        }
        else if (acceptable(key, value)) {
            target[key] = value;
        }
    }
    return true;
}
