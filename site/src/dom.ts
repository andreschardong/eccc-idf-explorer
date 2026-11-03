// Tiny DOM helpers. All text goes through text nodes, never innerHTML.

// DOM event handlers take many event types; `any` here keeps call sites readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (event: any) => void;
export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue | Handler>;
export type Child = Node | string | number | null | undefined | false | Child[];

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(node: Element, attrs: Attrs | null | undefined): void {
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      if (name.startsWith('on')) node.addEventListener(name.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(name, value === true ? '' : String(value));
    }
  }
}

export function append<T extends Node>(node: T, children: Child[]): T {
  for (const child of children.flat(Infinity as 1) as Exclude<Child, Child[]>[]) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** h('div', { class: 'x', onclick: fn }, 'text', child) -> HTMLElement */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  return append(node, children);
}

/** s('path', { d: '...' }) -> SVGElement */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  return append(node, children);
}

export function clear<T extends Element>(node: T): T {
  node.replaceChildren();
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} in index.html`);
  return element as T;
}

/** Calls `callback` on the container's width changes, once immediately. Returns a disposer. */
export function observeWidth(container: HTMLElement, callback: (width: number) => void): () => void {
  let last = -1;
  const run = (): void => {
    const width = Math.floor(container.clientWidth);
    if (width > 0 && width !== last) {
      last = width;
      callback(width);
    }
  };
  const observer = new ResizeObserver(run);
  observer.observe(container);
  run();
  return () => observer.disconnect();
}
