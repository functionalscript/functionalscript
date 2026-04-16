export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type Assert<T extends true> = T

const complex = (open: string, close: string) => (i: readonly string[]) =>
    `${open}${i.join(',')}${close}`

export const tuple: (types: readonly string[]) => string =
    complex('readonly[', ']')

const structX = complex('{', '}')

export const struct = (fields: readonly (readonly[string, string])[]): string =>
    structX(fields.map(([k, v]) => `readonly${JSON.stringify(k)}:${v}`))

export const array = (type: string): string =>
    `readonly(${type})[]`

export const record = (type: string): string =>
    structX([`readonly[k in string]:${type}`])

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