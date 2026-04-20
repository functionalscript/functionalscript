export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type Assert<T extends true> = T

const complex = (open: string, close: string) => (i: readonly string[]) =>
    `${open}${i.join(',')}${close}`

const structX = complex('{', '}')

/** Functions for emitting TypeScript type expression strings. */
export type Printer = {
    /** Emits a tuple type: `readonly[A, B]` or `[A, B]` when mutable. */
    readonly tuple: (types: readonly string[]) => string
    /** Emits an object type with named fields: `{readonly"k":T}` or `{"k":T}` when mutable. */
    readonly struct: (fields: readonly (readonly[string, string])[]) => string
    /** Emits an array type: `readonly(T)[]` or `(T)[]` when mutable. */
    readonly array: (type: string) => string
    /** Emits an index-signature record type: `{readonly[k:string]:T}` or `{[k:string]:T}` when mutable. */
    readonly record: (type: string) => string
}

/** Creates a `Printer`. Pass `true` to emit mutable (non-`readonly`) types. */
export const printer = (mut?: true): Printer => {
    const ro = mut ? '' : 'readonly'
    return {
        tuple: (mut ? complex('[', ']') : complex('readonly[', ']')),
        struct: (fields: readonly (readonly[string, string])[]) =>
            structX(fields.map(([k, v]) => `${ro}${JSON.stringify(k)}:${v}`)),
        array: (type: string) => `${ro}(${type})[]`,
        record: (type: string) => structX([`${ro}[k:string]:${type}`]),
    }
}

export const primitive = (c: bigint|string|undefined|boolean|number|null): string => {
    if (c === null) { return 'null' }
    switch (typeof c) {
        case 'bigint': return `${c}n`
        case 'string': return JSON.stringify(c)
        case 'number': return isFinite(c) ? String(c) : 'number'
        case 'undefined':
        case 'boolean': return String(c)
    }
}

export const union = (types: readonly string[]): string =>
    types.length === 0 ? 'never' : types.join('|')