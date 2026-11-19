// Sign-in gate bypassed: downloads are direct, free, and immediate.
import { el } from "./dom.js";

export async function requireSignIn(reason) {
    // Zero-friction: no sign-in required to download!
    return true;
}

export function mountAccount(container) {
    if (!container)
        return;
    const badge = el("div", { className: "acct-pill" },
        el("span", { className: "acct-dot" }),
        el("span", { className: "acct-text", textContent: "Free & Unlimited • 60 FPS" })
    );
    container.replaceChildren(badge);
}
