// Main orchestration: preview loop, ratio management, thumbnails, branding and interaction wiring.
import { embedded, restore } from "./account.js";
import { buildStops, initControls, setPalette, setTab, syncControls } from "./controls.js";
import { $, $$, el } from "./dom.js";
import { initExport, refreshSizes } from "./exporter.js";
import { restoreAfterReturn } from "./persist.js";
import { LABEL_FONTS, context2d, fontSpec, render, renderGradient } from "./render.js";
import { mountAccount } from "./signin.js";
import { FORMS, PRESETS, RATIOS, S, ratioValue, withState } from "./state.js";

const canvas = $("#cv");
const ctx = context2d(canvas);
let clock = 0;
let last = performance.now();
let raf = 0;
let recording = false;

const previewWidth = () => canvas.getBoundingClientRect().width;
const draw = () => render(ctx, canvas.width, canvas.height, clock, previewWidth());

function loop() {
    if (recording)
        return;
    const now = performance.now();
    clock += ((now - last) / 1000) * (S.speed / 100);
    last = now;
    draw();
    raf = requestAnimationFrame(loop);
}

/** Runs the clock while motion is active, else draws a single static frame. */
function sync() {
    cancelAnimationFrame(raf);
    last = performance.now();
    if (recording)
        return;
    if (S.motion)
        loop();
    else
        draw();
}

function fit() {
    const r = canvas.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * density);
    canvas.height = Math.round(r.height * density);
    draw();
}

// ---------- thumbnails and logo
const thumbs = new Map();
let thumbsQueued = 0;

function drawThumbs() {
    thumbsQueued = 0;
    for (const [type, thumb] of thumbs) {
        withState({ type, grain: 0, glass: 0, motion: false }, () =>
            renderGradient(context2d(thumb), thumb.width, thumb.height, 1.2, false)
        );
    }
    updateLogo();
}

const queueThumbs = () => {
    thumbsQueued ||= requestAnimationFrame(drawThumbs);
};

function buildThumbs(onPick) {
    const host = $("#thumbs");
    for (const form of FORMS) {
        const thumb = el("canvas", { width: 216, height: 136 });
        const button = el("button", { type: "button", className: "th", title: form.name }, thumb, el("span", { textContent: form.name }));
        button.dataset.t = form.id;
        button.addEventListener("click", () => onPick(form.id));
        thumbs.set(form.id, thumb);
        host.append(button);
    }
}

const logoCanvas = el("canvas", { width: 96, height: 96 });

/** The mark in the top bar is coloured with the active gradient. */
function updateLogo() {
    if (embedded())
        return;
    withState({ grain: 0, glass: 0 }, () => renderGradient(context2d(logoCanvas), 96, 96, clock, false));
    const logoI = $(".logo i");
    if (logoI)
        logoI.style.backgroundImage = `url(${logoCanvas.toDataURL()})`;
}

// ---------- canvas ratio & shape
function shapeIcon(icon, ratio, box, dashed) {
    const r = ratio ?? 1.5;
    const w = r >= 1 ? box : box * r;
    const h = r >= 1 ? box / r : box;
    icon.style.width = `${Math.round(w)}px`;
    icon.style.height = `${Math.round(h)}px`;
    icon.classList.toggle("dash", dashed);
}

function fitStage() {
    const view = $(".view");
    const frame = $("#frame");
    const r = ratioValue();
    if (r) {
        let w = view.clientWidth;
        let h = w / r;
        if (h > view.clientHeight) {
            h = view.clientHeight;
            w = h * r;
        }
        frame.style.width = `${Math.floor(w)}px`;
        frame.style.height = `${Math.floor(h)}px`;
    }
    else {
        frame.style.width = "100%";
        frame.style.height = "100%";
    }
    refreshSizes();
}

function syncRatio() {
    $("#rlabel").textContent = S.ratio === "custom" ? `${S.cw}×${S.ch}` : (RATIOS.find((r) => r.id === S.ratio)?.label ?? "Free");
    shapeIcon($("#rico"), ratioValue(), 14, S.ratio === "free");
    for (const b of $$(".ropt"))
        b.classList.toggle("on", b.dataset.r === S.ratio);
    for (const id of ["cw", "ch"]) {
        const input = $(`#${id}`);
        if (document.activeElement !== input)
            input.value = String(S[id]);
    }
}

function setRatioOpen(open) {
    $("#rpop").classList.toggle("open", open);
    $("#rbtn").setAttribute("aria-expanded", String(open));
}

function buildRatios() {
    for (const r of RATIOS) {
        const icon = el("i");
        shapeIcon(icon, r.ratio, 22, r.id === "free");
        const button = el("button", { type: "button", className: "ropt" }, icon, el("span", { textContent: r.label }));
        button.dataset.r = r.id;
        button.addEventListener("click", () => {
            S.ratio = r.id;
            fitStage();
            syncAll();
            setRatioOpen(false);
        });
        $("#rgrid").append(button);
    }
    $("#rbtn").addEventListener("click", (e) => {
        e.stopPropagation();
        setRatioOpen(!$("#rpop").classList.contains("open"));
    });
    $("#rpop").addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => setRatioOpen(false));
    for (const id of ["cw", "ch"]) {
        $(`#${id}`).addEventListener("input", (e) => {
            const value = Math.max(100, Math.min(8000, Number(e.target.value) || 0));
            S[id] = value;
            S.ratio = "custom";
            fitStage();
            syncAll();
        });
    }
}

function syncAll() {
    syncControls();
    syncRatio();
}

function changed() {
    syncAll();
    queueThumbs();
    if (!S.motion && !recording)
        draw();
}

let toastTimer = 0;
function toast(message) {
    const box = $("#toast");
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 2000);
}

function loadImage(file) {
    if (!file?.type.startsWith("image/"))
        return;
    const img = new Image();
    img.onload = () => {
        S.img = img;
        S.imgName = file.name;
        setTab("image");
        changed();
    };
    img.src = URL.createObjectURL(file);
}

function loadFont(font) {
    void document.fonts?.load(fontSpec(font, 40)).then(() => {
        if (!S.motion && !recording)
            draw();
    });
}

let motionBefore = S.motion;
function setRecording(on) {
    recording = on;
    if (on) {
        motionBefore = S.motion;
        cancelAnimationFrame(raf);
    }
    else {
        S.motion = motionBefore;
        sync();
    }
    syncAll();
}

function start() {
    if (embedded())
        document.documentElement.classList.add("embedded");

    initControls({
        changed,
        motionToggled: sync,
        fontPicked: () => loadFont(S.font),
        imagePicked: loadImage,
    });

    buildThumbs((type) => {
        if (type === S.type)
            return;
        S.type = type;
        buildStops();
        changed();
    });

    buildRatios();
    initExport({ preview: canvas, clock: () => clock, recording: setRecording, toast });
    mountAccount($("#account"));

    const view = $(".view");
    view.addEventListener("dragover", (e) => e.preventDefault());
    view.addEventListener("drop", (e) => {
        e.preventDefault();
        loadImage(e.dataTransfer?.files[0]);
    });

    for (const font of Object.keys(LABEL_FONTS))
        loadFont(font);

    setInterval(() => {
        if (S.motion && !recording)
            updateLogo();
    }, 300);

    new ResizeObserver(fit).observe(canvas);
    new ResizeObserver(fitStage).observe(view);

    if (restoreAfterReturn()) {
        buildStops();
        $("#label").value = S.label;
    }
    else {
        setPalette(PRESETS[0].colours);
    }

    setTab(S.tab);
    fitStage();
    fit();
    changed();
    sync();
    void restore();
}

start();
