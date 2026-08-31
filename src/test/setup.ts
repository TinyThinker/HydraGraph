import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Polyfills for @xyflow/react in jsdom
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).ResizeObserver) {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = ResizeObserverPolyfill
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).requestAnimationFrame) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 16)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).cancelAnimationFrame) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
}

afterEach(() => {
  cleanup()
})
