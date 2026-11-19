// DOM helpers: elements are made with properties and text, never from raw HTML strings.
export function $(selector, root = document) {
    const found = root.querySelector(selector);
    if (!found)
        throw new Error(`Missing ${selector}`);
    return found;
}

export const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
];

export function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
}
