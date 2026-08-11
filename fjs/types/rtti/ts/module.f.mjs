/**
 * Runtime printer mirroring the `Ts<T>` type transformer for RTTI schemas.
 * See `./types.ts` for `Ts<T>` and the `*Ts` transformer types.
 *
 * @module
 */
import { primitive, union, printer as tsPrinter } from '../../ts/module.f.mjs'
/** @import { Const, Type } from '../types.ts' */

/**
 * Creates a printer that converts an RTTI schema `Type` to its TypeScript type expression as a string.
 *
 * Mirrors the compile-time `Ts<T>` mapped type at runtime.
 * Pass `true` to emit mutable (non-`readonly`) types.
 *
 * **Note:** recursive schemas (e.g. `const list = () => ['array', list] as const`)
 * will cause infinite recursion. Only acyclic schemas are supported.
 *
 * **Note:** the `unknown` schema produces the string `'unknown'` (TypeScript's built-in),
 * whereas `Ts<>` maps it to `DjsUnknown` from `djs/module.f.ts`.
 *
 * @example
 * ```js
 * const toTs = printer()
 * toTs(boolean)                    // 'boolean'
 * toTs(array(number))              // 'readonly(number)[]'
 * toTs(record(string))             // '{readonly[k in string]?:string}'
 * toTs(or(string, number))         // 'string|number'
 * toTs(42)                         // '42'
 * toTs('hello')                    // '"hello"'
 * toTs([boolean, number])          // 'readonly[boolean,number]'
 * toTs({ x: string })              // '{readonly"x":string}'
 *
 * const toTsMut = printer(true)
 * toTsMut(array(number))           // '(number)[]'
 * toTsMut(record(string))          // '{[k in string]?:string}'
 * ```
 *
 * @type {(mut?: true) => (rtti: Type) => string}
 */
export const printer = mut => {
    const { tuple, struct, array, record } = tsPrinter(mut)

    /** @type {(rtti: Const) => string} */
    const constToTs = rtti =>
        typeof rtti !== 'object' || rtti === null ? primitive(rtti) :
        rtti instanceof Array ? tuple(rtti.map(toTs)) :
        struct(Object.entries(rtti).map(([k, v]) => [k, toTs(v)]))

    /** @type {(rtti: Type) => string} */
    const toTs = rtti => {
        if (typeof rtti !== 'function') { return constToTs(rtti) }
        const [tag, ...rest] = rtti()
        switch (tag) {
            case 'const': return constToTs(/** @type {Const} */ (rest[0]))
            case 'array': return array(toTs(rest[0]))
            case 'record': return record(toTs(rest[0]))
            case 'or': return union(rest.map(toTs))
            default: return tag // tag0: 'boolean' | 'number' | 'string' | 'bigint' | 'unknown'
        }
    }

    return toTs
}
