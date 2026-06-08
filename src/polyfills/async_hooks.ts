// Browser polyfill for node:async_hooks
// This is needed because @tanstack/react-start tries to use AsyncLocalStorage in the browser

export class AsyncLocalStorage<T = any> {
  private store: T | undefined;

  constructor() {
    this.store = undefined;
  }

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: () => R): R {
    const previousStore = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previousStore;
    }
  }

  exit<R>(callback: () => R): R {
    const previousStore = this.store;
    this.store = undefined;
    try {
      return callback();
    } finally {
      this.store = previousStore;
    }
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
