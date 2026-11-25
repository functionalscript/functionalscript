/**
 * How a program links L1 ([slice 11](../../todo/slices.md)): the linked
 * names of L1's functions and constants, `l1.add`, the terms of L1 that
 * read them so, what a term calls or reads of its own module, `link`, which
 * merges a program with the bodies of L1 that it reaches, `linkAny`, which
 * merges Any's IR module the same way so scalar ops become the program's
 * own functions ([checkpoint 4e](../../../../doc/sasha-gil/ir/runtime-in-ir.md)),
 * `linkString`, which merges String's short-path `length` / `unit` after
 * Any ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S3),
 * and `errorTable`, which reads L1's error table from its text, for
 * [the lowering](../module.f.js).
 *
 * @module
 *
 * @import { Block } from '../../../js/ast/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { ConstantOf, Fn, Module, Term } from '../../types.ts'
 */

import { error, ok } from '../../../types/result/module.f.js'
import { definedBy, terms } from '../../module.f.js'

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

/** The name of a function or a constant of Any in a program that links it: `any.kind`, `any.undefined`. @type {(name: string) => string} */
export const linkedAnyName = name => `any.${name}`

/**
 * A term with each `Any.*` call and constant rewritten to a linked name of
 * `self`. When `own` is set, each of those names that the term also calls
 * or reads of `self` is rewritten the same way — for Any's own bodies,
 * which still say `self.kind`. A program's bodies pass an empty `own`, so
 * a user `self.kind` stays the program's function.
 *
 * @type {(own: readonly string[], rename: (name: string) => string) => (t: Term) => Term}
 */
const rewriteAny = (own, rename) => {
    /** @type {(t: Term) => Term} */
    const linked = t => {
        switch (t[0]) {
            case 'let': { return ['let', t[1], linked(t[2]), linked(t[3])] }
            case 'op': { return t[3] === undefined ? ['op', t[1], t[2].map(linked)] : ['op', t[1], t[2].map(linked), t[3]] }
            case 'call': {
                const module = t[1] === 'Any' ? 'self' : t[1]
                const name = t[1] === 'Any' || (t[1] === 'self' && own.includes(t[2])) ? rename(t[2]) : t[2]
                return ['call', module, name, t[3].map(linked)]
            }
            case 'call_ref': { return ['call_ref', linked(t[1]), t[2].map(linked)] }
            case 'make': { return ['make', t[1].map(([k, x]) => /** @type {const} */ ([k, linked(x)]))] }
            case 'field': { return ['field', linked(t[1]), t[2]] }
            case 'variant': { return ['variant', t[1], t[2], linked(t[3])] }
            case 'match': { return ['match', linked(t[1]), t[2].map(([vs, b, x]) => /** @type {const} */ ([vs, b, linked(x)]))] }
            case 'block': { return ['block', t[1], t[2], linked(t[3])] }
            case 'loop': { return ['loop', t[1], t[2].map(([k, type, x]) => /** @type {const} */ ([k, type, linked(x)])), linked(t[3])] }
            case 'br': { return ['br', t[1], linked(t[2])] }
            case 'constant': {
                return t[1] === 'Any' || (t[1] === 'self' && own.includes(t[2]))
                    ? ['constant', 'self', rename(t[2])]
                    : t
            }
            default: { return t }
        }
    }
    return linked
}

/**
 * A program that links Any's IR module
 * ([checkpoint 4e](../../../../doc/sasha-gil/ir/runtime-in-ir.md)): drops the `Any`
 * import, keeps `Ref` (and the rest of L0), defines `any`, rewrites every
 * `Any.*` call and constant to a linked name `any.kind` (as L1 uses
 * `l1.add`), and merges the bodies of Any that the program reaches —
 * always including the hooks that `defines` names and whatever they call.
 * Linked names leave the program's own exports free, so a program may
 * still export `kind`. Any exports nothing into the program's export
 * list. A program that already defines a type, that imports no `Any`, or
 * whose own name collides with a reached linked name, is refused.
 *
 * @type {(any: Module) => (program: Module) => Result<Module, string>}
 */
export const linkAny = any => program => {
    const own = definedBy(program)
    if (own !== null) { return error(`the program already defines ${own}`) }
    if (any.defines === undefined) { return error('Any has no defines') }
    if (program.imports.find(([k]) => k === 'Any') === undefined) { return error('the program imports no Any') }
    const withoutAny = program.imports.filter(([k]) => k !== 'Any')
    const refImport = any.imports.find(([k]) => k === 'Ref')
    if (refImport === undefined) { return error('Any imports no Ref') }
    /** @type {Module['imports']} */
    const imports = withoutAny.find(([k]) => k === 'Ref') !== undefined ? withoutAny : [refImport, ...withoutAny]
    const short = [
        ...any.functions.map(([k]) => k),
        ...(any.constants ?? []).map(([k]) => k),
    ]
    // Program bodies: only `Any.*`. Any's bodies: also their own `self.*`.
    const rewriteProgram = rewriteAny([], linkedAnyName)
    const rewriteOwn = rewriteAny(short, linkedAnyName)
    /** @type {readonly (readonly [string, Fn])[]} */
    const anyFunctions = any.functions.map(([k, f]) => [linkedAnyName(k), { ...f, body: rewriteOwn(f.body) }])
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const anyConstants = (any.constants ?? []).map(([k, c]) => [linkedAnyName(k), { type: c.type, value: rewriteOwn(c.value) }])
    /** @type {readonly (readonly [string, Fn])[]} */
    const functions = program.functions.map(([k, f]) => [k, { ...f, body: rewriteProgram(f.body) }])
    const ownConstants = program.constants ?? []
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const constants = ownConstants.map(([k, c]) => [k, { type: c.type, value: rewriteProgram(c.value) }])
    /** The hooks that a module which defines `any` must hold, by their linked names. */
    const hooks = any.defines.types.flatMap(([, d]) => [d.kind, d.dup, d.drop].flatMap(x => x === undefined ? [] : [linkedAnyName(x)]))
    /** @type {(name: string) => readonly string[]} */
    const usesOf = name => {
        const f = anyFunctions.find(([k]) => k === name)
        const c = anyConstants.find(([k]) => k === name)
        return f !== undefined ? uses(f[1].body) : c !== undefined ? uses(c[1].value) : []
    }
    let todo = [
        ...hooks,
        ...functions.flatMap(([, f]) => uses(f.body)),
        ...constants.flatMap(([, c]) => uses(c.value)),
    ]
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
    const kept = reached.filter(name =>
        anyFunctions.find(([x]) => x === name) !== undefined || anyConstants.find(([x]) => x === name) !== undefined)
    const collide = kept.find(name =>
        functions.find(([x]) => x === name) !== undefined || constants.find(([x]) => x === name) !== undefined)
    if (collide !== undefined) { return error(`${collide} is already a function or constant of the program`) }
    /** @type {NonNullable<Module['defines']>} */
    const defines = {
        name: /** @type {string} */ (definedBy(any)),
        types: any.defines.types.map(([type, d]) => /** @type {const} */ ([type, {
            ...d,
            ...(d.kind === undefined ? {} : { kind: linkedAnyName(d.kind) }),
            ...(d.dup === undefined ? {} : { dup: linkedAnyName(d.dup) }),
            ...(d.drop === undefined ? {} : { drop: linkedAnyName(d.drop) }),
        }])),
    }
    return ok({
        imports,
        defines,
        constants: [...anyConstants.filter(([x]) => kept.includes(x)), ...constants],
        functions: [...functions, ...anyFunctions.filter(([x]) => kept.includes(x))],
        exports: program.exports,
    })
}

/** The name of a String short-path function in a program that links it: `string.length`. @type {(name: string) => string} */
export const linkedStringName = name => `string.${name}`

/**
 * String ops that the short path replaces. Allocators and the rest stay
 * L0 imports; the long miss of length/unit still calls `String.*`.
 *
 * @type {readonly string[]}
 */
const stringShortOps = ['length', 'unit']

/**
 * A term with linked String short-path names. When `rewriteImports` is set,
 * each `String.length` / `String.unit` becomes a linked `self` call — for
 * program bodies. String's own bodies pass `rewriteImports` false so their
 * long-miss `String.*` imports stay imports; `own` still renames their
 * `self.unitN` helpers. Other `String.*` calls stay imports either way.
 *
 * @type {(own: readonly string[], rename: (name: string) => string, rewriteImports: boolean) => (t: Term) => Term}
 */
const rewriteString = (own, rename, rewriteImports) => {
    /** @type {(t: Term) => Term} */
    const linked = t => {
        switch (t[0]) {
            case 'let': { return ['let', t[1], linked(t[2]), linked(t[3])] }
            case 'op': { return t[3] === undefined ? ['op', t[1], t[2].map(linked)] : ['op', t[1], t[2].map(linked), t[3]] }
            case 'call': {
                const fromString = rewriteImports && t[1] === 'String' && stringShortOps.includes(t[2])
                const fromOwn = t[1] === 'self' && own.includes(t[2])
                const module = fromString ? 'self' : t[1]
                const name = fromString || fromOwn ? rename(t[2]) : t[2]
                return ['call', module, name, t[3].map(linked)]
            }
            case 'call_ref': { return ['call_ref', linked(t[1]), t[2].map(linked)] }
            case 'make': { return ['make', t[1].map(([k, x]) => /** @type {const} */ ([k, linked(x)]))] }
            case 'field': { return ['field', linked(t[1]), t[2]] }
            case 'variant': { return ['variant', t[1], t[2], linked(t[3])] }
            case 'match': { return ['match', linked(t[1]), t[2].map(([vs, b, x]) => /** @type {const} */ ([vs, b, linked(x)]))] }
            case 'block': { return ['block', t[1], t[2], linked(t[3])] }
            case 'loop': { return ['loop', t[1], t[2].map(([k, type, x]) => /** @type {const} */ ([k, type, linked(x)])), linked(t[3])] }
            case 'br': { return ['br', t[1], linked(t[2])] }
            case 'constant': {
                return t[1] === 'self' && own.includes(t[2])
                    ? ['constant', 'self', rename(t[2])]
                    : t
            }
            default: { return t }
        }
    }
    return linked
}

/**
 * A program that links String's short-path IR
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S3):
 * keeps the `String` import for the long miss and for allocators, rewrites
 * every `String.length` / `String.unit` to a linked name `string.length`,
 * and merges the bodies of String that the program reaches. The program
 * must already define Any (after `linkAny`); String's standalone module
 * defines Any only so its bodies may `unseal` under check. A program that
 * imports no `String`, that does not define Any, or whose own name collides
 * with a reached linked name, is refused.
 *
 * @type {(stringModule: Module) => (program: Module) => Result<Module, string>}
 */
export const linkString = stringModule => program => {
    if (definedBy(program) !== 'Any') { return error('the program does not define Any') }
    if (program.imports.find(([k]) => k === 'String') === undefined) {
        return error('the program imports no String')
    }
    const short = stringModule.functions.map(([k]) => k)
    // Program: rewrite String.length/unit. Own bodies: rename self helpers only.
    const rewriteProgram = rewriteString([], linkedStringName, true)
    const rewriteOwn = rewriteString(short, linkedStringName, false)
    /** @type {readonly (readonly [string, Fn])[]} */
    const stringFunctions = stringModule.functions.map(([k, f]) => [linkedStringName(k), { ...f, body: rewriteOwn(f.body) }])
    /** @type {readonly (readonly [string, Fn])[]} */
    const functions = program.functions.map(([k, f]) => [k, { ...f, body: rewriteProgram(f.body) }])
    const ownConstants = program.constants ?? []
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const constants = ownConstants.map(([k, c]) => [k, { type: c.type, value: rewriteProgram(c.value) }])
    /** @type {(name: string) => readonly string[]} */
    const usesOf = name => {
        const f = stringFunctions.find(([k]) => k === name)
        return f !== undefined ? uses(f[1].body) : []
    }
    let todo = [
        ...functions.flatMap(([, f]) => uses(f.body)),
        ...constants.flatMap(([, c]) => uses(c.value)),
    ]
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
    const kept = reached.filter(name => stringFunctions.find(([x]) => x === name) !== undefined)
    const collide = kept.find(name =>
        functions.find(([x]) => x === name) !== undefined || constants.find(([x]) => x === name) !== undefined)
    if (collide !== undefined) { return error(`${collide} is already a function or constant of the program`) }
    return ok({
        imports: program.imports,
        defines: /** @type {NonNullable<Module['defines']>} */ (program.defines),
        constants,
        functions: [...functions, ...stringFunctions.filter(([x]) => kept.includes(x))],
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
        : entries.find(([k], i) => entries.findIndex(([j]) => j === k) !== i) !== undefined ? error('the error table names an error twice')
        : ok(entries)
}
