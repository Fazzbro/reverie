// Account and session helper: Free access, no sign-in required.
export const TOOL_ID = "gradient-generator";

let user = {
    email: "guest@devault.design",
    name: "Guest Creator",
    picture: undefined,
};

const listeners = new Set();

export const currentUser = () => user;

export function onAuthChange(fn) {
    listeners.add(fn);
    fn(user);
}

export async function restore() {
    // Free access: no remote auth gate needed
}

export async function signOut() {
    // No-op
}

export const embedded = () => globalThis.top !== globalThis.self;

export function signInWithGoogle() {
    return Promise.resolve(true);
}

export function cancelSignIn() {}

export async function saveOffersConsent() {}

export function noteExport(format) {
    // Local log of export format
    try {
        const count = Number(localStorage.getItem(`export_${format}`) || "0") + 1;
        localStorage.setItem(`export_${format}`, String(count));
    } catch {}
}
