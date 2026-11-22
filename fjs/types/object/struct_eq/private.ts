/** A suspended comparison. Each container holds the index of its next child. */
export type StructEqStack<V, E> = undefined | (
    { readonly tag: 'value'; readonly a: V; readonly b: V }
    | { readonly tag: 'array'; readonly i: number; readonly a: readonly V[]; readonly b: readonly V[] }
    | { readonly tag: 'object'; readonly i: number; readonly a: readonly E[]; readonly b: readonly E[] }
) & { readonly n: StructEqStack<V, E> }
