/**
 * How a program links L1 ([slice 11](../../todo/slices.md)): the linked
 * names of L1's functions and constants, `l1.add`, the terms of L1 that
 * read them so, what a term calls or reads of its own module, `link`, which
 * merges a program with the bodies of L1 that it reaches, and `errorTable`,
 * which reads L1's error table from its text, for
 * [the lowering](../module.f.js).
 *
 * @module
 *
 * @import { Block } from '../../../js/ast/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { ConstantOf, Fn, Module, Term } from '../../types.ts'
 */

import { error, ok } from '../../../types/result/module.f.js'
import { terms } from '../../module.f.js'

/** The name of a function or a constant of L1 in a program that links it: `l1.add`, `l1.#c0`. @type {(name: string) => string} */
export const linkedName = name => `l1.${name}`

/**
 * A term of L1 as a program that links L1 holds it: each function and
 * constant of L1's own that it calls or reads by its linked name.
 *
 * @type {(t: Term) => Term}
 */
const linkedTerm = t => {
    switch (t[0]) {
        case 'let': { return ['let', t[1], linkedTerm(t[2]), linkedTerm(t[3])] }
        case 'op': { return t[3] === undefined ? ['op', t[1], t[2].map(linkedTerm)] : ['op', t[1], t[2].map(linkedTerm), t[3]] }
        case 'call': { return ['call', t[1], t[1] === 'self' ? linkedName(t[2]) : t[2], t[3].map(linkedTerm)] }
        case 'code': { return ['code', linkedName(t[1])] }
        case 'call_ref': { return ['call_ref', linkedTerm(t[1]), t[2].map(linkedTerm)] }
        case 'make': { return ['make', t[1].map(([k, x]) => /** @type {const} */ ([k, linkedTerm(x)]))] }
        case 'field': { return ['field', linkedTerm(t[1]), t[2]] }
        case 'variant': { return ['variant', t[1], t[2], linkedTerm(t[3])] }
        case 'match': { return ['match', linkedTerm(t[1]), t[2].map(([vs, b, x]) => /** @type {const} */ ([vs, b, linkedTerm(x)]))] }
        case 'block': { return ['block', t[1], t[2], linkedTerm(t[3])] }
        case 'loop': { return ['loop', t[1], t[2].map(([k, type, x]) => /** @type {const} */ ([k, type, linkedTerm(x)])), linkedTerm(t[3])] }
        case 'br': { return ['br', t[1], linkedTerm(t[2])] }
        case 'constant': { return t[1] === 'self' ? ['constant', 'self', linkedName(t[2])] : t }
        default: { return t }
    }
}

/** The functions and constants of the module's own that a term calls or reads, by their names. @type {(t: Term) => readonly string[]} */
export const uses = t => [
    ...(t[0] === 'call' && t[1] === 'self' ? [t[2]] : t[0] === 'code' ? [t[1]] : t[0] === 'constant' && t[1] === 'self' ? [t[2]] : []),
    ...terms(t).flatMap(uses),
]

/**
 * A program that links L1, as one module
 * ([slice 11](../../todo/slices.md)): the program's functions and constants,
 * and those of L1 that they call or read, themselves or through others of
 * L1, each by its linked name, `l1.add`, L1's constants first, since a
 * constant of the program may call L1. The program exports what it
 * exports, and L1 nothing. Both import the runtime's interfaces, and a
 * program that imports others than L1 does is refused.
 *
 * @type {(l1: Module) => (program: Module) => Result<Module, string>}
 */
export const link = l1 => program => {
    const names = program.imports.map(([k]) => k).join(' ')
    if (l1.imports.map(([k]) => k).join(' ') !== names) { return error(`L1 imports ${l1.imports.map(([k]) => k).join(' ')}, and the program ${names}`) }
    /** @type {readonly (readonly [string, Fn])[]} */
    const functions = l1.functions.map(([k, f]) => [linkedName(k), { ...f, body: linkedTerm(f.body) }])
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const constants = (l1.constants ?? []).map(([k, c]) => [linkedName(k), { type: c.type, value: linkedTerm(c.value) }])
    /** @type {(name: string) => readonly string[]} */
    const usesOf = name => {
        const f = functions.find(([k]) => k === name)
        const c = constants.find(([k]) => k === name)
        return f !== undefined ? uses(f[1].body) : c !== undefined ? uses(c[1].value) : []
    }
    const own = program.constants ?? []
    let todo = [...program.functions.flatMap(([, f]) => uses(f.body)), ...own.flatMap(([, c]) => uses(c.value))]
    /** @type {readonly string[]} */
    let reached = []
    let k = 0
    while (k < todo.length) {
        const x = todo[Number(k)]
        k = k + 1
        if (!reached.includes(x)) {
            reached = [...reached, x]
            todo = [...todo, ...usesOf(x)]
        }
    }
    const kept = reached
    return ok({
        imports: program.imports,
        constants: [...constants.filter(([x]) => kept.includes(x)), ...own],
        functions: [...program.functions, ...functions.filter(([x]) => kept.includes(x))],
        exports: program.exports,
    })
}

/**
 * L1's error table, from the normalized FAST of its module's text
 * ([`l1/error`](../../../wasm/runtime/l1/error/module.f.js)): the export
 * `error`, an object literal of the text of each error, by its name, in
 * their order. The module exports nothing else, and no name twice. The runtime gives it to [`lower`](../module.f.js#lower), which writes a
 * read of one, `error.k`, as the string literal of its text.
 *
 * @type {(fast: Block) => Result<readonly (readonly [string, string])[], string>}
 */
export const errorTable = ({ exit }) => {
    const exports = exit[0] === 'yield' && exit[1].length === 1 ? exit[1][0] : null
    if (!(exports instanceof Array) || exports[0] !== 'object') { return error('a module that yields no object of exports has no error table') }
    if (exports[1].length !== 1) { return error('an error module exports error and nothing else') }
    const [only] = exports[1]
    const table = only[0] === ':' && only[1] === 'error' ? only[2] : null
    if (!(table instanceof Array) || table[0] !== 'object') { return error('the module exports no object literal error') }
    const entries = table[1].flatMap(x => x[0] === ':' && typeof x[1] === 'string' && typeof x[2] === 'string' ? [/** @type {const} */ ([x[1], x[2]])] : [])
    return entries.length !== table[1].length ? error('an error that is not a string of a name is not in this slice')
        // JavaScript reads the last of two entries of one name, and a lowering that read the first would throw another text.
        : entries.some(([k], i) => entries.findIndex(([j]) => j === k) !== i) ? error('the error table names an error twice')
        : ok(entries)
}
