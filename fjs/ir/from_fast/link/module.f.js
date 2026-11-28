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

/**
 * Which of a term's names a linker renames: a call `module.name`, a function
 * value `code name` of the module's own (`self`), or a constant `module.name`.
 *
 * @typedef {'call' | 'code' | 'constant'} NameUse
 */

/**
 * A term with each name that `linked` answers for rewritten to that name of
 * `self`, and every other name kept. The one walker that every linker uses.
 *
 * @type {(linked: (module: string, name: string, use: NameUse) => string | null) => (t: Term) => Term}
 */
const renamed = linked => {
    /** @type {(module: string, name: string, use: NameUse) => readonly [string, string]} */
    const named = (module, name, use) => {
        const to = linked(module, name, use)
        return to === null ? [module, name] : ['self', to]
    }
    /** @type {(t: Term) => Term} */
    const go = t => {
        switch (t[0]) {
            case 'let': { return ['let', t[1], go(t[2]), go(t[3])] }
            case 'op': { return t[3] === undefined ? ['op', t[1], t[2].map(go)] : ['op', t[1], t[2].map(go), t[3]] }
            case 'call': { return ['call', ...named(t[1], t[2], 'call'), t[3].map(go)] }
            case 'code': { return ['code', named('self', t[1], 'code')[1]] }
            case 'call_ref': { return ['call_ref', go(t[1]), t[2].map(go)] }
            case 'make': { return ['make', t[1].map(([k, x]) => /** @type {const} */ ([k, go(x)]))] }
            case 'field': { return ['field', go(t[1]), t[2]] }
            case 'variant': { return ['variant', t[1], t[2], go(t[3])] }
            case 'match': { return ['match', go(t[1]), t[2].map(([vs, b, x]) => /** @type {const} */ ([vs, b, go(x)]))] }
            case 'block': { return ['block', t[1], t[2], go(t[3])] }
            case 'loop': { return ['loop', t[1], t[2].map(([k, type, x]) => /** @type {const} */ ([k, type, go(x)])), go(t[3])] }
            case 'br': { return ['br', t[1], go(t[2])] }
            case 'constant': { return ['constant', ...named(t[1], t[2], 'constant')] }
            default: { return t }
        }
    }
    return go
}

/** The functions and constants of the module's own that a term calls or reads, by their names. @type {(t: Term) => readonly string[]} */
export const uses = t => [
    ...(t[0] === 'call' && t[1] === 'self' ? [t[2]] : t[0] === 'code' ? [t[1]] : t[0] === 'constant' && t[1] === 'self' ? [t[2]] : []),
    ...terms(t).flatMap(uses),
]

/**
 * How one runtime module links into a program.
 *
 * - `prefix` gives the linked name of each of the runtime's functions and
 *   constants, `l1.add`, `any.kind`, `string.length`.
 * - `redirect` says which names of the program's bodies the runtime takes
 *   over: an import that the program calls or reads, `Any.kind`, which
 *   becomes `self.any.kind`. The runtime's own bodies keep their imports,
 *   as String's long miss keeps `String.length`.
 * - `roots` are names of the runtime that are linked whether the program
 *   reaches them or not: the hooks that a defined type names.
 *
 * @typedef {{
 *   readonly prefix: (name: string) => string,
 *   readonly redirect: (module: string, name: string, use: NameUse) => boolean,
 *   readonly roots: readonly string[],
 * }} Linker
 */

/**
 * The functions and constants of a program that links a runtime: the
 * program's own, with its bodies redirected, and those of the runtime that
 * they reach, themselves or through others of the runtime, or that `roots`
 * names, each by its linked name, the runtime's constants first, since a
 * constant of the program may read one. A name of the program's own that is
 * one of the reached linked names is refused.
 *
 * @type {(linker: Linker) => (runtime: Module, program: Module) => Result<Pick<Module, 'constants' | 'functions'>, string>}
 */
const merged = ({ prefix, redirect, roots }) => (runtime, program) => {
    const runtimeConstants = runtime.constants ?? []
    const names = [...runtime.functions.map(([k]) => k), ...runtimeConstants.map(([k]) => k)]
    // The runtime's bodies: a call, value or read of its own `self` name.
    const own = renamed((module, name) => module === 'self' && names.includes(name) ? prefix(name) : null)
    // The program's bodies: the imports that the runtime takes over.
    const taken = renamed((module, name, use) => redirect(module, name, use) ? prefix(name) : null)
    /** @type {readonly (readonly [string, Fn])[]} */
    const linkedFunctions = runtime.functions.map(([k, f]) => [prefix(k), { ...f, body: own(f.body) }])
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const linkedConstants = runtimeConstants.map(([k, c]) => [prefix(k), { type: c.type, value: own(c.value) }])
    /** @type {readonly (readonly [string, Fn])[]} */
    const functions = program.functions.map(([k, f]) => [k, { ...f, body: taken(f.body) }])
    /** @type {readonly (readonly [string, ConstantOf<Term>])[]} */
    const constants = (program.constants ?? []).map(([k, c]) => [k, { type: c.type, value: taken(c.value) }])
    /** @type {(name: string) => readonly string[]} */
    const usesOf = name => {
        const f = linkedFunctions.find(([k]) => k === name)
        const c = linkedConstants.find(([k]) => k === name)
        return f !== undefined ? uses(f[1].body) : c !== undefined ? uses(c[1].value) : []
    }
    let todo = [
        ...roots.map(prefix),
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
    const all = reached
    /** @type {(name: string) => boolean} */
    const kept = name => all.includes(name)
    /** @type {(name: string) => boolean} */
    const linked = name => kept(name) && (linkedFunctions.find(([x]) => x === name) !== undefined || linkedConstants.find(([x]) => x === name) !== undefined)
    const collide = [...functions, ...constants].find(([x]) => linked(x))
    return collide !== undefined ? error(`${collide[0]} is already a function or constant of the program`) : ok({
        constants: [...linkedConstants.filter(([x]) => kept(x)), ...constants],
        functions: [...functions, ...linkedFunctions.filter(([x]) => kept(x))],
    })
}

/** The name of a function or a constant of L1 in a program that links it: `l1.add`, `l1.#c0`. @type {(name: string) => string} */
export const linkedName = name => `l1.${name}`

/**
 * A program that links L1, as one module
 * ([slice 11](../../todo/slices.md)): the program's functions and constants,
 * and those of L1 that they call or read, themselves or through others of
 * L1, each by its linked name, `l1.add`, L1's constants first, since a
 * constant of the program may call L1. The program already names L1's by
 * their linked names, so nothing of its own is redirected. The program
 * exports what it exports, and L1 nothing. Both import the runtime's
 * interfaces, and a program that imports others than L1 does, or that has
 * its own function or constant of a reached linked name, is refused.
 *
 * @type {(l1: Module) => (program: Module) => Result<Module, string>}
 */
export const link = l1 => program => {
    const names = program.imports.map(([k]) => k).join(' ')
    if (l1.imports.map(([k]) => k).join(' ') !== names) { return error(`L1 imports ${l1.imports.map(([k]) => k).join(' ')}, and the program ${names}`) }
    const m = merged({ prefix: linkedName, redirect: () => false, roots: [] })(l1, program)
    return m[0] === 'error' ? m : ok({ imports: program.imports, ...m[1], exports: program.exports })
}

/** The name of a function or a constant of Any in a program that links it: `any.kind`, `any.undefined`. @type {(name: string) => string} */
export const linkedAnyName = name => `any.${name}`

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
    /** The hooks that a module which defines `any` must hold. */
    const hooks = any.defines.types.flatMap(([, d]) => [d.kind, d.dup, d.drop].flatMap(x => x === undefined ? [] : [x]))
    const m = merged({ prefix: linkedAnyName, redirect: module => module === 'Any', roots: hooks })(any, program)
    if (m[0] === 'error') { return m }
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
    return ok({ imports, defines, ...m[1], exports: program.exports })
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
 * A program that links String's short-path IR
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S3):
 * keeps the `String` import for the long miss and for allocators, rewrites
 * every call `String.length` / `String.unit` of the program to a linked
 * name `string.length`, and merges the bodies of String that the program
 * reaches. String's own bodies keep their `String.*` imports, which are the
 * long miss. The program must already define Any (after `linkAny`);
 * String's standalone module defines Any only so its bodies may `unseal`
 * under check. A program that imports no `String`, that does not define
 * Any, or whose own name collides with a reached linked name, is refused.
 *
 * @type {(stringModule: Module) => (program: Module) => Result<Module, string>}
 */
export const linkString = stringModule => program => {
    if (definedBy(program) !== 'Any') { return error('the program does not define Any') }
    if (program.imports.find(([k]) => k === 'String') === undefined) {
        return error('the program imports no String')
    }
    const m = merged({
        prefix: linkedStringName,
        redirect: (module, name, use) => module === 'String' && use === 'call' && stringShortOps.includes(name),
        roots: [],
    })(stringModule, program)
    return m[0] === 'error' ? m : ok({
        imports: program.imports,
        defines: /** @type {NonNullable<Module['defines']>} */ (program.defines),
        ...m[1],
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
