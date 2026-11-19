// Side panel controls: sliders, switches, segmented controls, colour stops, presets, image tab.
import { listedStops, rating, hslToRgb, toHex } from "./colour.js";
import { $, $$, el } from "./dom.js";
import { FORMS, LAYERED, LIGHT_TO_DARK, PRESETS, S, SHUFFLES, formName, random } from "./state.js";

const pct = (v) => `${v}%`;
const deg = (v) => `${v}°`;
const plain = String;
const spec = (key, label, min, max, step = 1, fmt = pct) => ({
    key,
    label,
    min,
    max,
    step,
    fmt,
});
const blendSlider = spec("blend", "Blend", 0, 100);
const angleSlider = spec("angle", "Angle", 0, 360, 1, deg);

const FORM_SLIDERS = {
    melt: [
        spec("scale", "Scale", 0, 100),
        spec("melt", "Melt", 0, 100),
        spec("rise", "Rise", 0, 100),
        spec("peaks", "Peaks", 0, 100),
        spec("tilt", "Tilt", -45, 45, 1, deg),
        blendSlider,
        spec("glow", "Glow", 0, 100),
    ],
    mesh: [spec("size", "Blob size", 30, 120)],
    silk: [spec("folds", "Folds", 1, 10, 0.5, plain), spec("twist", "Twist", 0, 100), spec("sang", "Angle", 0, 180, 1, deg), blendSlider],
    beams: [
        spec("rays", "Rays", 2, 20, 0.5, plain),
        spec("srcx", "Source left / right", 0, 100),
        spec("srcy", "Source up / down", 0, 100),
        spec("rreach", "Reach", 30, 200),
        blendSlider,
    ],
    glow: [spec("gang", "Angle", 0, 360, 1, deg), spec("gwarp", "Warp", 0, 100), spec("gspot", "Light spots", 0, 100), blendSlider],
    ripple: [
        spec("rrings", "Rings", 2, 16, 0.5, plain),
        spec("rwarp", "Warp", 0, 100),
        spec("rcx", "Centre left / right", 0, 100),
        spec("rcy", "Centre up / down", 0, 100),
        blendSlider,
    ],
    ribbons: [
        spec("ramp", "Wave", 0, 100),
        spec("rwid", "Width", 10, 100),
        spec("rtilt", "Tilt", -60, 60, 1, deg),
        spec("rsoft", "Edge softness", 0, 100),
    ],
    tide: [spec("amp", "Wave height", 0, 100), spec("freq", "Waves", 1, 10, 0.5, plain), spec("soft", "Blend", 0, 100)],
    halo: [spec("hsize", "Size", 20, 140), spec("squash", "Squash", 30, 100), spec("posy", "Height", 0, 100), spec("soft", "Blend", 0, 100)],
    horizon: [
        spec("horizon", "Bulb height", 0, 60),
        spec("sun", "Bulb size", 4, 50),
        spec("spread", "Spread", 40, 200),
        spec("reach", "Reach", 30, 140),
        spec("hblend", "Blend", 0, 100),
    ],
    linear: [angleSlider],
    radial: [],
    conic: [angleSlider],
};

const PANEL_SLIDERS = {
    glassBox: [spec("glass", "Glass bars", 0, 100), spec("gbars", "Bar count", 6, 80, 1, plain), spec("gloss", "Gloss", 0, 100)],
    imgBox: [
        spec("iblur", "Blur", 0, 100),
        spec("ibright", "Brightness", 50, 150),
        spec("icont", "Contrast", 50, 150),
        spec("isat", "Saturation", 0, 200),
        spec("iscale", "Zoom", 100, 300),
        spec("ix", "Position left / right", 0, 100),
        spec("iy", "Position up / down", 0, 100),
    ],
    ovBox: [spec("gopac", "Gradient opacity", 0, 100)],
    textBox: [spec("tsize", "Text size", 30, 160, 1, (v) => `${v}px`)],
    colourBox: [spec("hue", "Hue", -180, 180, 1, deg), spec("vivid", "Vivid", 0, 100)],
    grainBox: [spec("grain", "Grain", 0, 100, 1, plain), spec("gsize", "Grain size", 1, 4, 0.5, (v) => `${v}×`)],
    motionBox: [spec("speed", "Speed", 10, 300, 1, (v) => `${(v / 100).toFixed(1)}×`)],
};

export const BLEND_MODES = [
    { value: "source-over", label: "Normal" },
    { value: "overlay", label: "Overlay" },
    { value: "soft-light", label: "Soft light" },
    { value: "multiply", label: "Multiply" },
    { value: "screen", label: "Screen" },
    { value: "color", label: "Colour" },
    { value: "hue", label: "Hue" },
    { value: "lighten", label: "Lighten" },
    { value: "difference", label: "Difference" },
];

const FADE_CHOICES = [
    { value: "none", label: "No fade (full cover)" },
    { value: "bottom", label: "Bottom edge" },
    { value: "top", label: "Top edge" },
    { value: "left", label: "Left edge" },
    { value: "right", label: "Right edge" },
];

const sliders = [];
const formBoxes = new Map();
let changed = () => undefined;

export function fillTrack(input) {
    const min = Number(input.min);
    const span = Number(input.max) - min || 1;
    input.style.setProperty("--p", `${((Number(input.value) - min) / span) * 100}%`);
}

function addSlider(box, s) {
    const out = el("b");
    const input = el("input", { type: "range", min: String(s.min), max: String(s.max), step: String(s.step) });
    input.setAttribute("aria-label", s.label);
    input.addEventListener("input", () => {
        S[s.key] = Number(input.value);
        changed();
    });
    const head = el("div", { className: "lbl" }, el("span", { textContent: s.label }), out);
    box.append(el("div", { className: "field" }, head, input));
    sliders.push({ spec: s, input, out });
}

function buildSliders() {
    const host = $("#formBoxes");
    for (const form of FORMS) {
        const box = el("div", { className: "form-box" });
        for (const s of FORM_SLIDERS[form.id])
            addSlider(box, s);
        formBoxes.set(form.id, box);
        host.append(box);
    }
    for (const [id, list] of Object.entries(PANEL_SLIDERS)) {
        const box = $(`#${id}`);
        for (const s of list)
            addSlider(box, s);
    }
}

function buildSelects() {
    $("#blendMode").append(...BLEND_MODES.map((m) => el("option", { value: m.value, textContent: m.label })));
    $("#fadeDir").append(...FADE_CHOICES.map((f) => el("option", { value: f.value, textContent: f.label })));
}

const HEX = /^#[0-9a-f]{6}$/i;
function stopRow(index, fixed) {
    const stop = S.stops[index];
    const colour = el("input", { type: "color", value: stop.c.toLowerCase() });
    colour.setAttribute("aria-label", `Colour ${index + 1}`);
    const text = el("input", { type: "text", value: stop.c.toLowerCase(), maxLength: 7 });
    text.setAttribute("aria-label", `Colour ${index + 1} hex code`);
    const pos = el("input", { type: "range", min: "0", max: "100", value: String(stop.p), disabled: fixed });
    pos.setAttribute("aria-label", `Colour ${index + 1} position`);
    const grade = el("span", { className: "rate" });
    const remove = el("button", { type: "button", className: "x", title: "Remove", textContent: "×" });
    remove.setAttribute("aria-label", `Remove colour ${index + 1}`);
    colour.addEventListener("input", () => {
        stop.c = colour.value;
        text.value = colour.value;
        changed();
    });
    text.addEventListener("change", () => {
        if (!HEX.test(text.value)) {
            text.value = stop.c;
            return;
        }
        stop.c = text.value.toLowerCase();
        colour.value = stop.c;
        changed();
    });
    pos.addEventListener("input", () => {
        stop.p = Number(pos.value);
        changed();
    });
    remove.addEventListener("click", () => {
        if (S.stops.length <= 2)
            return;
        S.stops.splice(index, 1);
        buildStops();
        changed();
    });
    return el("div", { className: "stop" }, colour, text, pos, grade, remove);
}

export function buildStops() {
    const box = $("#stops");
    const fixed = LAYERED.has(S.type);
    box.replaceChildren(...S.stops.map((_, i) => stopRow(i, fixed)));
    $("#add").disabled = S.stops.length >= 8;
    for (const input of $$('input[type="range"]', box))
        fillTrack(input);
}

export function setPalette(colours) {
    const last = Math.max(1, colours.length - 1);
    S.stops = colours.map((c, i) => ({ c: c.toLowerCase(), p: Math.round((i * 100) / last) }));
    buildStops();
    changed();
}

function randomPalette() {
    const n = S.stops.length;
    const hue = random() * 360;
    const direction = random() < 0.5 ? 1 : -1;
    const span = 60 + random() * 120;
    const lightToDark = LIGHT_TO_DARK.has(S.type);
    setPalette(Array.from({ length: n }, (_, i) => {
        const t = i / Math.max(1, n - 1);
        const light = lightToDark ? 0.95 - t * 0.88 : 0.35 + random() * 0.4;
        return toHex(...hslToRgb(hue + direction * span * t, 0.55 + random() * 0.4, light));
    }));
    S.seed = random() * 100;
    changed();
}

function addStop() {
    const last = S.stops.at(-1);
    const colour = `#${Math.floor(random() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}`;
    S.stops.push({ c: colour, p: Math.min(100, (last?.p ?? 90) + 10) });
    buildStops();
    changed();
}

function buildPresets() {
    const box = $("#presets");
    for (const preset of PRESETS) {
        const button = el("button", { type: "button", title: preset.name });
        button.setAttribute("aria-label", `${preset.name} palette`);
        button.style.background = `linear-gradient(to top,${preset.colours.join(",")})`;
        button.addEventListener("click", () => setPalette(preset.colours));
        box.append(button);
    }
}

function segment(id, attr, pick) {
    $(`#${id}`).addEventListener("click", (e) => {
        const button = e.target.closest("button");
        const value = button?.dataset[attr];
        if (value && !button.disabled)
            pick(value);
    });
}

const markOn = (id, attr, current) => {
    for (const b of $$(`#${id} button`))
        b.classList.toggle("on", b.dataset[attr] === current);
};

export function setTab(tab) {
    S.tab = tab;
    markOn("tabs", "tab", tab);
    for (const section of $$("aside section[data-tab]")) {
        section.hidden = section.dataset.tab !== tab && section.dataset.tab !== "both";
    }
}

function syncForm() {
    const type = S.type;
    for (const thumb of $$(".th"))
        thumb.classList.toggle("on", thumb.dataset.t === type);
    $("#formName").textContent = formName(type);
    for (const [id, box] of formBoxes)
        box.hidden = id !== type;
    $("#shuffle").hidden = !SHUFFLES.has(type);
    $("#dirF").hidden = type !== "melt";
}

function syncSwitch(id, on) {
    const sw = $(`#${id}`);
    sw.classList.toggle("on", on);
    sw.setAttribute("aria-pressed", String(on));
}

function syncSegments() {
    markOn("dirs", "d", S.dir);
    markOn("txtSeg", "x", S.text);
    markOn("fontSeg", "f", S.font);
    syncSwitch("motion", S.motion);
    syncSwitch("tagsSw", S.tags);
    const current = S.stops.map((s) => s.c.toLowerCase()).join();
    $$("#presets button").forEach((b, i) => {
        b.classList.toggle("on", PRESETS[i].colours.map((c) => c.toLowerCase()).join() === current);
    });
}

function syncSliders() {
    for (const { spec: s, input, out } of sliders) {
        input.value = String(S[s.key]);
        out.textContent = s.fmt(S[s.key]);
        fillTrack(input);
    }
}

function syncImage() {
    const has = S.img !== null;
    $("#imgName").textContent = S.imgName;
    $("#imgPrev").hidden = !has;
    $("#drop").hidden = has;
    $("#imgBtns").hidden = !has;
    const preview = $("#prevImg");
    if (S.img && preview.src !== S.img.src)
        preview.src = S.img.src;
    $("#imgBox").classList.toggle("off", !has);
    $("#blendMode").value = S.bmode;
    $("#fadeDir").value = S.fade;
}

function syncColours() {
    const stops = listedStops();
    $("#cnt").textContent = String(S.stops.length);
    const tags = $("#tags");
    tags.hidden = !S.tags;
    tags.replaceChildren(...stops
        .slice()
        .reverse()
        .map((s) => {
        const swatch = el("i");
        swatch.style.background = s.c;
        return el("div", { className: "tag" }, swatch, s.c.toUpperCase());
    }));
    $$(".stop").forEach((row, i) => {
        const stop = stops[i];
        const grade = row.querySelector(".rate");
        if (!stop || !grade)
            return;
        const r = rating(stop.c);
        grade.textContent = r.grade;
        grade.title = `${r.ratio}:1 with ${r.text} text`;
    });
    const bits = [S.type, `${S.stops.length} colours`];
    if (S.grain)
        bits.push(`grain ${S.grain}`);
    if (S.motion)
        bits.push("moving");
    $("#badge").textContent = bits.join(" · ");
}

export function syncControls() {
    syncForm();
    syncSegments();
    syncSliders();
    syncImage();
    syncColours();
}

export function initControls(hooks) {
    changed = hooks.changed;
    buildSliders();
    buildSelects();
    buildPresets();
    segment("dirs", "d", (d) => {
        S.dir = d;
        changed();
    });
    segment("txtSeg", "x", (x) => {
        S.text = x;
        changed();
    });
    segment("fontSeg", "f", (f) => {
        S.font = f;
        hooks.fontPicked();
        changed();
    });
    segment("tabs", "tab", (t) => setTab(t));
    $("#label").addEventListener("input", (e) => {
        S.label = e.target.value;
        changed();
    });
    $("#tagsSw").addEventListener("click", () => {
        S.tags = !S.tags;
        syncControls();
    });
    $("#motion").addEventListener("click", () => {
        S.motion = !S.motion;
        hooks.motionToggled();
        syncControls();
    });
    $("#add").addEventListener("click", addStop);
    $("#rand").addEventListener("click", randomPalette);
    $("#shuffle").addEventListener("click", () => {
        S.seed = random() * 100;
        changed();
    });
    $("#file").addEventListener("change", (e) => hooks.imagePicked(e.target.files?.[0]));
    $("#imgReplace").addEventListener("click", () => $("#file").click());
    $("#imgRemove").addEventListener("click", () => {
        S.img = null;
        S.imgName = "";
        $("#file").value = "";
        changed();
    });
    $("#blendMode").addEventListener("change", (e) => {
        S.bmode = e.target.value;
        changed();
    });
    $("#fadeDir").addEventListener("change", (e) => {
        S.fade = e.target.value;
        changed();
    });
    $("#toDesign").addEventListener("click", () => setTab("design"));
}
