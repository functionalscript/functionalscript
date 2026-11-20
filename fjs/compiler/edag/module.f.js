/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstImport } from '../ast/types.ts'
 * @import { _Load } from '../source/types.ts'
 * @import { ParseError, ResolvedModule } from '../parser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { _Linked, _Resolved, Unresolved } from './types.ts'
 * @import { List } from '../../types/list/types.ts'
 * @import { PersistentMap } from '../../types/map/types.ts'
 */

import { tryNormalize } from '../../js/ast/sugar/module.f.js'
import { fromFast } from '../../edag/from_fast/module.f.js'
import { _fileError, _jsonModule, _program, _programOver } from '../source/module.f.js'
import { pureOk } from '../../effects/module.f.js'
import { error, mapOk, ok, unwrap } from '../../types/result/module.f.js'
import { assert } from '../../asserts/module.f.js'
import { entry } from '../../types/object/entry/module.f.js'
import { fromEntries, mapHas, mapSet } from '../../types/map/module.f.js'
import { next } from '../../types/list/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { entries } from '../../types/ordered_map/module.f.js'
import { withBodies } from '../../edag/sharing/module.f.js'

const args = /** @type {const} */ (['args'])

/** Import `i` as the module's EDAG sees it: a property of the arguments. @type {(imported: AstImport, i: number) => Exp} */
const parameter = (imported, i) => {
    const name = entry(imported, 'name')
    assert(name !== undefined)
    return name === null ? ['.', args, i] : ['.', ['.', args, i], name]
}

/**
 * Source expansion supplies explicit immutable bindings and required roots;
 * graph construction consumes those normalized FAST values.
 *
 * @type {(imports: readonly Exp[]) => (module: ResolvedModule) => Result<Exp, string>}
 */
const lowered = imports => module => {
    const fast = tryNormalize(module, imports)
    return fast[0] === 'error' ? fast : ok(fromFast(fast[1].body, fast[1].parameters.map((id, i) => [id, imports[Number(i)]])))
}

/** @type {(imports: readonly AstImport[]) => (edag: Exp) => Unresolved} */
const over = imports => edag => ({ imports, edag })

/** Convert a resolved source AST, reporting unsupported AST-to-FAST constructs. @type {(module: ResolvedModule) => Result<Unresolved, string>} */
export const tryUnresolved = module => mapOk(over(module.imports.map(({ binding, ...record }) => record)))(lowered(module.imports.map(parameter))(module))

/**
 * The module as an EDAG over its imports, before any of them is read: each
 * import is its parameter node, and the specifiers ride beside the graph
 * for the resolution to read.
 *
 * @type {(module: ResolvedModule) => Unresolved}
 */
export const unresolved = module => unwrap(tryUnresolved(module))

/**
 * Whether a module's computation ends in a `throw`, past its evaluation
 * sequence: a module whose body ends in the statement in place of its
 * exports ([spec: module structure](../../../spec/modules/README.md)).
 * Such a module fails at every load and exports nothing.
 *
 * @type {(module: Exp) => boolean}
 */
export const _moduleThrows = module => module instanceof Array
    && (module[0] === 'throw' || (module[0] === ',' && _moduleThrows(module[1][Number(module[1].length - 1)])))

/**
 * The statically known exports at a module boundary, past its evaluation
 * sequence: none for a module that throws, since nothing is exported by a
 * load that never completes. A malformed boundary is an internal compiler
 * error.
 *
 * @type {(module: Exp) => readonly (readonly [':', string, Exp])[]}
 */
export const _moduleExports = module => {
    if (module instanceof Array) {
        if (module[0] === ',') { return _moduleExports(module[1][Number(module[1].length - 1)]) }
        if (module[0] === 'throw') { return [] }
        if (module[0] === '{}' && module[1].every(p => p[0] === ':' && typeof p[1] === 'string')) {
            return /** @type {readonly (readonly [':', string, Exp])[]} */ (module[1])
        }
    }
    throw 'expected a module export object'
}

/**
 * Select a default value while evaluating the whole module. The default-only
 * shape keeps its normalized spelling; a named module keeps its complete
 * computation under the access, including unselected initializers. A missing
 * default projects to undefined here; import linking checks presence separately.
 * A module that throws is its own selection: selecting anything from it is
 * the same failure, and the throw is what the computation is.
 *
 * @type {(module: Exp) => Exp}
 */
export const _defaultExport = module => {
    if (_moduleThrows(module)) { return module }
    const members = _moduleExports(module)
    if (members.length !== 1 || members[0][1] !== 'default') { return ['.', module, 'default'] }
    if (module instanceof Array && module[0] === ',') {
        const operands = module[1]
        return [',', [...operands.slice(0, -1), _defaultExport(operands[Number(operands.length - 1)])]]
    }
    return members[0][2]
}

/**
 * Select a named export's value while evaluating the whole module: the
 * module's computation stays, as an anchor, and the selection is the value
 * the export object holds under the name, the same node. No property is
 * read, so a name a read refuses, `map` or `entries`, is written as source.
 *
 * @type {(module: Exp, value: Exp) => Exp}
 */
const namedExport = (module, value) =>
    [',', [...(module instanceof Array && module[0] === ',' ? module[1] : [module]), value]]

// ── resolution ────────────────────────────────────────────────────────────────

/** A module's EDAG and its bindings, each export selected as an import reads it. @type {(edag: Exp, path?: string | null, imports?: readonly Exp[]) => _Resolved} */
const resolved = (edag, path = null, imports = []) => ({
    exports: edag,
    bindings: _moduleExports(edag).map(([, key, value]) => [key, key === 'default' ? _defaultExport(edag) : namedExport(edag, value)]),
    path,
    imports,
})

/**
 * What the linker makes of a module: its EDAG, lowered over the EDAGs its
 * imports select — the binding happens where a reference is lowered, so the
 * graph is built once, with the imported module's node where its parameter
 * would be, and a diamond of imports joins at one node. A JSON module is the
 * tree its document denotes, under `default`.
 *
 * @type {_Load<_Resolved, Exp, ParseError>}
 */
const linking = {
    json: value => resolved(_jsonModule(value)),
    select: ({ exports, bindings }, name) => name === null ? exports : bindings.find(([key]) => key === name)?.[1],
    module: ({ path }, imports, module) => {
        const loweredModule = lowered(imports)(module)
        return loweredModule[0] === 'error' ? error(_fileError(path)(loweredModule[1])) : ok(resolved(loweredModule[1], path, imports))
    },
}

/**
 * The program at `path` as one EDAG: the module read and parsed, each of
 * its imports resolved the same way, recursively, and every import bound in
 * its parameter's place — a JSON module, imported `with { type: "json" }`,
 * as the tree its document denotes, as `transpile` reads one. A `.json`
 * root is a document, as it is for `transpile`. The result carries no path
 * and no parameter: the `Unresolved` layer is the compiler's, and is gone
 * once the link is done.
 *
 * Fails as `transpile` fails, with the same `ParseError`: a parse error
 * where its token is, and a missing file or a circular dependency with no
 * position; and as `unresolved` refuses, on a module whose export does not
 * reach every import and every `const`.
 *
 * @type {(path: string) => Effect<ReadWhole | ResolveFileModule, Exp, ParseError>}
 */
export const resolve = _program(pureOk(linking), ({ exports }) => exports)

/**
 * {@link resolve} over the modules earlier links completed, answering the
 * program with those modules and its own: a module another program already
 * reached is not read again, as a diamond of imports within one program
 * joins at one module. For a caller that links many programs of one tree,
 * `fjs compile`'s check of every `.f.js`; `null` is no modules yet. A link
 * that fails answers no modules, and its caller keeps the ones it had.
 *
 * Sharing assumes what one run can: a file read once is the file every later
 * program means.
 *
 * @type {(path: string, linked: _Linked) => Effect<ReadWhole | ResolveFileModule, readonly [_Linked, Exp], ParseError>}
 */
export const resolveOver = _programOver(pureOk(linking), ({ exports }) => exports)

/**
 * Whether the module made `node`: it is reached from the module's exports,
 * or from an export as an import selects it, without passing what the
 * module's own imports selected. Past those the nodes are other modules'.
 *
 * @type {(module: _Resolved, node: Exp) => boolean}
 */
const made = ({ exports, bindings, imports }, node) => {
    /** @type {PersistentMap<unknown, boolean>} */
    let seen = fromEntries(imports.flatMap(value => value instanceof Array ? [/** @type {readonly [unknown, boolean]} */ ([value, true])] : []))
    /** @type {List<unknown>} */
    let pending = [exports, ...bindings.map(([, value]) => value)]
    while (true) {
        /** @type {ReturnType<typeof next<unknown>>} */
        const step = next(pending)
        if (step === null) { return false }
        /** @type {unknown} */
        const first = step.first
        /** @type {List<unknown>} */
        const rest = step.tail
        pending = rest
        if (!(first instanceof Array) || mapHas(seen, first)) { continue }
        if (first === /** @type {unknown} */ (node)) { return true }
        seen = mapSet(seen, first, true)
        pending = { head: withBodies(first), tail: rest }
    }
}

/**
 * The file of the module that made `node`, among the modules of a link, or
 * `null` where none did: a node of a JSON document, or of no module. A
 * linked graph holds no position, so a refusal of one of its nodes can name
 * the file it came from and no more.
 *
 * @type {(linked: _Linked, node: Exp) => string | null}
 */
export const _owner = (linked, node) => {
    const module = toArray(entries(linked)).find(([, module]) => module.path !== null && made(module, node))
    return module === undefined ? null : module[1].path
}
