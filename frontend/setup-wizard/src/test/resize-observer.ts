/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * A `ResizeObserver` a test can drive: the test DOM lays nothing out, so a test says how wide the observed elements
 * are and the observers hear it. Installing replaces the global for the test; `restore()` puts the original back.
 */

export interface ResizeControl {
    /** Reports `width` pixels for every observed element. Wrap it in `act()`: observers update state. */
    resize(width: number): void;
    restore(): void;
}

export function installResizeObserver(): ResizeControl {
    const original: unknown = Reflect.get(globalThis, 'ResizeObserver');
    const observers = new Set<FakeResizeObserver>();

    class FakeResizeObserver implements ResizeObserver {
        readonly targets = new Set<Element>();
        private readonly callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
            observers.add(this);
        }

        observe(target: Element): void {
            this.targets.add(target);
        }

        unobserve(target: Element): void {
            this.targets.delete(target);
        }

        disconnect(): void {
            this.targets.clear();
            observers.delete(this);
        }

        report(width: number): void {
            const entries = [...this.targets].map((target): ResizeObserverEntry => ({
                target,
                contentRect: new DOMRect(0, 0, width, 0),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
            }));
            if (entries.length > 0) {
                this.callback(entries, this);
            }
        }
    }

    Reflect.set(globalThis, 'ResizeObserver', FakeResizeObserver);
    return {
        resize: (width: number): void => observers.forEach((observer) => observer.report(width)),
        restore: (): void => {
            Reflect.set(globalThis, 'ResizeObserver', original);
        },
    };
}
