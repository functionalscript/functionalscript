export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

export type Assert<T extends true> = T

/**
 * A TypeScript type expression, represented as a tagged readonly tuple.
 *
 * Used to build up type structures that can be serialized to `.d.ts` content.
 */
export type TsType =
    | readonly['boolean']
    | readonly['number']
    | readonly['string']
    | readonly['bigint']
    | readonly['null']
    | readonly['undefined']
    | readonly['unknown']
    | readonly['literal', boolean | number | string | bigint]
    | readonly['array', TsType]
    | readonly['record', TsType]
    | readonly['object', readonly (readonly[string, TsType])[]]
    | readonly['tuple', readonly TsType[]]
    | readonly['union', readonly TsType[]]
    | readonly['ref', string]

/** A top-level declaration in a `.d.ts` file. */
export type TsDecl = readonly['type', string, TsType]

/** Serializes a `TsType` to its TypeScript source string. */
export const tsType = (t: TsType): string => {
    switch (t[0]) {
        case 'literal': {
            const [, value] = t
            return typeof value === 'bigint' ? `${value}n` : JSON.stringify(value)
        }
        case 'array': {
            const [, value] = t
            const s = tsType(value)
            return `readonly ${value[0] === 'union' ? `(${s})` : s}[]`
        }
        case 'record': {
            const [, value] = t
            return `{ readonly[k in string]: ${tsType(value)} }`
        }
        case 'object': {
            const [, value] = t
            if (value.length === 0) { return '{}' }
            return `{ ${value.map(([k, v]) => `readonly ${k}: ${tsType(v)}`).join('; ')} }`
        }
        case 'tuple': {
            const [, value] = t
            return `readonly[${value.map(tsType).join(', ')}]`
        }
        case 'union': {
            const [, value] = t
            return value.map(tsType).join(' | ')
        }
        case 'ref': {
            const [, value] = t
            return value
        }
        // 'boolean' | 'number' | 'string' | 'bigint' | 'null' | 'undefined' | 'unknown'
        default: return t[0]
    }
}

/** Serializes a `TsDecl` to its TypeScript source string. */
export const tsDecl = (d: TsDecl): string =>
    `export type ${d[1]} = ${tsType(d[2])}`

/** Converts a list of declarations to `.d.ts` file content. */
export const tsDts = (decls: readonly TsDecl[]): string =>
    decls.map(tsDecl).join('\n')
