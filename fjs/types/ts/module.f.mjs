/**
 * TypeScript source-emitter helpers: the `Equal`/`Assert` compile-time
 * predicates and a `Printer` that renders tuples, structs, arrays, records,
 * primitive literals, and unions as TypeScript type expressions.
 *
 * @module
 */

/**
 * @template A, B
 * @typedef {(<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false} Equal
 */

/** @type {(open: string, close: string) => (i: readonly string[]) => string} */
const complex = (open, close) => i =>
    `${open}${i.join(',')}${close}`

const structX = complex('{', '}')

/**
 * Functions for emitting TypeScript type expression strings.
 *
 * @typedef {{
 *  readonly tuple: (types: readonly string[]) => string
 *  readonly struct: (fields: readonly (readonly[string, string])[]) => string
 *  readonly array: (type: string) => string
 *  readonly record: (type: string) => string
 * }} Printer
 */

/**
 * Creates a `Printer`. Pass `true` to emit mutable (non-`readonly`) types.
 *
 * @type {(mut?: true) => Printer}
 */
export const printer = (mut = undefined) => {
    const ro = mut ? '' : 'readonly'
    return {
        tuple: (mut ? complex('[', ']') : complex('readonly[', ']')),
        struct: fields =>
            structX(fields.map(([k, v]) => `${ro}${JSON.stringify(k)}:${v}`)),
        array: type => `${ro}(${type})[]`,
        // `[k:string]?:` is invalid TypeScript — optional keys on an infinite
        // key set require mapped-type syntax.
        record: type => structX([`${ro}[k in string]?:${type}`]),
    }
}

/**
 * @type {(c: bigint|string|undefined|boolean|number|null) => string}
 */
export const primitive = c => {
    if (c === null) { return 'null' }
    switch (typeof c) {
        case 'bigint': return `${c}n`
        case 'string': return JSON.stringify(c)
        case 'number': return isFinite(c) ? String(c) : 'number'
        case 'undefined':
        case 'boolean': return String(c)
    }
}

/** @type {(types: readonly string[]) => string} */
export const union = types =>
    types.length === 0 ? 'never' : types.join('|')
