/** Deferred work shared by FAST graph construction and normalization. @module */

export type Task<T> =
    | { readonly kind: 'done'; readonly value: T }
    | { readonly kind: 'call'; readonly run: () => Task<T> }
    | { readonly kind: 'bind'; readonly first: Task<unknown>; readonly next: (value: unknown) => Task<T> }
