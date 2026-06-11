// Browser/edge polyfill for node:async_hooks
// This is needed because @tanstack/react-start tries to use AsyncLocalStorage in the browser

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AsyncLocalStorage<T = any> {
  private store: T | undefined;

  constructor() {
    this.store = undefined;
  }

  getStore(): T | undefined {
    if (this.store !== undefined) return this.store;
    // In the browser, @tanstack/start-fn-stubs's createIsomorphicFn incorrectly
    // routes getStartOptions() through the server path (getStartContext().startOptions)
    // instead of the client path (window.__TSS_START_OPTIONS__). Return a compatible
    // default so getStartContext() doesn't throw, using the same value the client path
    // would have returned.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const startOptions = (window as any).__TSS_START_OPTIONS__ ?? {};
      return { startOptions, contextAfterGlobalMiddlewares: {} } as unknown as T;
    }
    return undefined;
  }

  run<R>(store: T, callback: () => R): R {
    const previousStore = this.store;
    this.store = store;
    let result: R;
    try {
      result = callback();
    } catch (error) {
      this.store = previousStore;
      throw error;
    }
    // For async callbacks, restore AFTER the promise settles — not synchronously.
    // The original try/finally approach reset this.store before any awaits inside
    // the callback completed, causing TanStack Start's getStore() to return undefined.
    if (result instanceof Promise) {
      return (result as Promise<unknown>).then(
        (v) => {
          this.store = previousStore;
          return v;
        },
        (e) => {
          this.store = previousStore;
          throw e;
        },
      ) as unknown as R;
    }
    this.store = previousStore;
    return result;
  }

  exit<R>(callback: () => R): R {
    return this.run(undefined as unknown as T, callback);
  }

  enterWith(store: T): void {
    this.store = store;
  }

  disable(): void {
    this.store = undefined;
  }
}

export default {
  AsyncLocalStorage,
};
