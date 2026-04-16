export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type Assert<T extends true> = T

export const tuple = (types: readonly string[]): string => `readonly[${types.join(',')}]`

export const struct = (fields: readonly (readonly[string, string])[]): string =>
    `{${fields.map(([k, v]) => `readonly${JSON.stringify(k)}:${v}`).join(',')}}`

export const array = (type: string): string => `readonly(${type})[]`

export const record = (type: string): string => `{readonly[k in string]:${type}}`

export const primitive = (c: bigint|string|undefined|boolean|number|null): string => {
    if (c === null) { return 'null' }
    switch (typeof c) {
        case 'bigint': return `${c}n`
        case 'string': return JSON.stringify(c)
        case 'undefined':
        case 'boolean':
        case 'number': return String(c)
    }
}

export const union = (types: readonly string[]): string =>
    types.length === 0 ? 'never' : types.join('|')