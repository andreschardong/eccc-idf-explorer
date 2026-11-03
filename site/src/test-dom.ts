// Helpers for tests that run in happy-dom, which has no layout engine.
import type { StationDetail } from './types';
import charlottetownJson from './test-data/8300301.json';
import cowichanJson from './test-data/1012055.json';

/** Real ECCC v3.40 data: a 50-year composite station with every duration analysed. */
export const charlottetown = charlottetownJson as StationDetail;

/** Real ECCC v3.40 data: a 14-year station where the 5 to 30 minute durations were not analysed. */
export const cowichan = cowichanJson as StationDetail;

export const FIXTURES: Record<string, StationDetail> = {
  [charlottetown.id]: charlottetown,
  [cowichan.id]: cowichan,
};

/**
 * Gives every element a width, as a browser would, and a ResizeObserver that never fires.
 * Charts draw when their container has a width, and happy-dom reports zero for everything.
 */
export function installLayoutStubs(width = 480): void {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 160 });
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
  Element.prototype.scrollIntoView = () => {};
}

export function press(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

export function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
