// Mutable editor state read by every renderer and written by every control.
export const S = {
    type: "melt",
    stops: [],
    seed: 3.7,
    angle: 135,
    size: 75,
    scale: 58,
    melt: 52,
    rise: 58,
    peaks: 32,
    tilt: 0,
    blend: 70,
    glow: 40,
    soft: 40,
    amp: 45,
    freq: 3,
    hsize: 90,
    squash: 100,
    posy: 50,
    horizon: 8,
    sun: 14,
    spread: 110,
    reach: 95,
    hblend: 75,
    glass: 0,
    gbars: 28,
    gloss: 60,
    rays: 7,
    srcx: 50,
    srcy: 0,
    rreach: 100,
    folds: 4,
    twist: 60,
    sang: 28,
    img: null,
    imgName: "",
    iscale: 100,
    ix: 50,
    iy: 50,
    iblur: 0,
    ibright: 100,
    icont: 100,
    isat: 100,
    gopac: 70,
    bmode: "overlay",
    fade: "none",
    tab: "design",
    ratio: "free",
    cw: 1920,
    ch: 1080,
    gang: 15,
    gwarp: 60,
    gspot: 55,
    rrings: 7,
    rwarp: 40,
    rcx: 50,
    rcy: 50,
    ramp: 45,
    rwid: 50,
    rtilt: -18,
    rsoft: 55,
    hue: 0,
    vivid: 50,
    grain: 20,
    gsize: 1.5,
    motion: true,
    speed: 60,
    dir: "right",
    text: "light",
    tags: true,
    label: "Reverie",
    font: "geist",
    tsize: 72,
};

/** Runs `fn` with temporary patch to state. */
export function withState(patch, fn) {
    const keep = {};
    for (const key of Object.keys(patch))
        Object.assign(keep, { [key]: S[key] });
    Object.assign(S, patch);
    try {
        return fn();
    }
    finally {
        Object.assign(S, keep);
    }
}

export const FORMS = [
    { id: "melt", name: "Melt" },
    { id: "mesh", name: "Mesh" },
    { id: "silk", name: "Silk" },
    { id: "beams", name: "Beams" },
    { id: "glow", name: "Glow" },
    { id: "ripple", name: "Ripple" },
    { id: "ribbons", name: "Ribbons" },
    { id: "tide", name: "Tide" },
    { id: "halo", name: "Halo" },
    { id: "horizon", name: "Horizon" },
    { id: "linear", name: "Linear" },
    { id: "radial", name: "Radial" },
    { id: "conic", name: "Conic" },
];

export const formName = (id) => FORMS.find((f) => f.id === id)?.name ?? id;

export const LAYERED = new Set(["mesh", "ribbons", "tide", "halo", "horizon"]);
export const SHUFFLES = new Set(["mesh", "melt", "tide", "silk", "beams", "glow", "ripple", "ribbons"]);
export const LIGHT_TO_DARK = new Set([
    "melt",
    "tide",
    "halo",
    "horizon",
    "silk",
    "beams",
    "glow",
    "ripple",
    "ribbons",
]);

export const PRESETS = [
    { name: "Flamingo", colours: ["#FFF0F3", "#F7A3C3", "#F3528D", "#B02A9A", "#391B99", "#140741"] },
    { name: "Lagoon", colours: ["#E6FFFA", "#7FE5D0", "#27B5C9", "#2A6FDB", "#1B2A8A", "#0A1033"] },
    { name: "Molten", colours: ["#FFF3C4", "#FFC247", "#FF7A1A", "#E5321F", "#7A1030", "#1C0614"] },
    { name: "Glacier", colours: ["#F4FBFF", "#BFE6FF", "#7CB8F5", "#4F7DE0", "#2B3D9A", "#0F1740"] },
    { name: "Ember", colours: ["#FFE8D6", "#FF9A62", "#F0533A", "#A61E3A", "#4A0F3A", "#12071F"] },
    { name: "Iris", colours: ["#F6F0FF", "#CDB8FF", "#9A7BFF", "#6A3DE8", "#3B1C9E", "#120A3A"] },
    { name: "Jade", colours: ["#F0FFE8", "#B9F29B", "#4FD18B", "#12A08A", "#0D5E78", "#07213A"] },
    { name: "Wine", colours: ["#FFEFEA", "#F3A6A0", "#D9506B", "#8E1F58", "#46113F", "#14071A"] },
    { name: "Sherbet", colours: ["#FFF6E0", "#FFC9A1", "#FF8FA3", "#E070D8", "#8F6CF0", "#3E3AA8"] },
    { name: "Ink", colours: ["#F2F2F2", "#BDBDC6", "#7E7E8E", "#42424F", "#1E1E28", "#09090D"] },
    { name: "Aurora", colours: ["#E8FFF4", "#7DF9C6", "#3FD0E8", "#5A7CF5", "#8A3FD6", "#1A0B3D"] },
    { name: "Candy", colours: ["#FFF0FA", "#FFB3E6", "#FF7AC8", "#B37CFF", "#6FA8FF", "#7FE8FF"] },
];

export const RATIOS = [
    { id: "free", label: "Free", ratio: null },
    { id: "16:9", label: "16:9", ratio: 16 / 9 },
    { id: "4:3", label: "4:3", ratio: 4 / 3 },
    { id: "1:1", label: "1:1", ratio: 1 },
    { id: "4:5", label: "4:5", ratio: 0.8 },
    { id: "3:4", label: "3:4", ratio: 0.75 },
    { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

export function ratioValue() {
    if (S.ratio === "custom")
        return S.cw / S.ch;
    return RATIOS.find((r) => r.id === S.ratio)?.ratio ?? null;
}

export function random() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
