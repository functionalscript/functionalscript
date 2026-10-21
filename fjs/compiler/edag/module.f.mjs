/**
 * A module as an EDAG: over its imports, compiled before any import is read,
 * and with its imports resolved into one graph — Stage 1 of
 * `../todo/compile-modules-to-edag.md`, both halves.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstImport } from '../ast/types.ts'
 * @import { _Load } from '../source/types.ts'
 * @import { ParseError, ResolvedModule } from '../parser/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Resolved } from './private.ts'
 */

import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { fromFast } from '../../edag/from_fast/module.f.mjs'
import { _jsonModule, _program } from '../source/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { ok } from '../../types/result/module.f.js'

const args = /** @type {const} */ (['args'])

/** Import `i` as the module's EDAG sees it: a property of the arguments. @type {(imported: AstImport, i: number) => Exp} */
const parameter = ({ name }, i) => name === null ? ['.', args, i] : ['.', ['.', args, i], name]

/**
 * Source expansion supplies explicit immutable bindings and required roots;
 * graph construction consumes those normalized FAST values.
 *
 * @type {(imports: readonly Exp[]) => (module: ResolvedModule) => Exp}
 */
const lowered = imports => module => {
    const fast = normalize(module, imports)
    return fromFast(fast.body, fast.parameters.map((id, i) => [id, imports[i]]))
}

/** @type {(imports: readonly AstImport[]) => (edag: Exp) => Unresolved} */
const over = imports => edag => ({ imports, edag })

/**
 * The module as an EDAG over its imports, before any of them is read: each
 * import is its parameter node, and the specifiers ride beside the graph
 * for the resolution to read.
 *
 * @type {(module: ResolvedModule) => Unresolved}
 */
export const unresolved = module => over(module.ast[0])(lowered(module.ast[0].map(parameter))(module))

/**
 * Whether a module's computation ends in a `throw`, past its evaluation
 * sequence: a module whose body ends in the statement in place of its
 * exports ([spec: module structure](../../../spec/modules/README.md)).
 * Such a module fails at every load and exports nothing.
 *
 * @type {(module: Exp) => boolean}
 */
export const _moduleThrows = module => module instanceof Array
    && (module[0] === 'throw' || (module[0] === ',' && _moduleThrows(module[1][module[1].length - 1])))

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
        if (module[0] === ',') { return _moduleExports(module[1][module[1].length - 1]) }
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
        return [',', [...operands.slice(0, -1), _defaultExport(operands[operands.length - 1])]]
    }
    return members[0][2]
}

// ── resolution ────────────────────────────────────────────────────────────────

/** A module's EDAG and its bindings, each export selected as an import reads it. @type {(edag: Exp) => _Resolved} */
const resolved = edag => ({
    exports: edag,
    bindings: _moduleExports(edag).map(([, key]) => [key, key === 'default' ? _defaultExport(edag) : ['.', edag, key]]),
})

/**
 * What the linker makes of a module: its EDAG, lowered over the EDAGs its
 * imports select — the binding happens where a reference is lowered, so the
 * graph is built once, with the imported module's node where its parameter
 * would be, and a diamond of imports joins at one node. A JSON module is the
 * tree its document denotes, under `default`.
 *
 * @type {_Load<_Resolved, Exp, never>}
 */
const linking = {
    json: value => resolved(_jsonModule(value)),
    select: ({ exports, bindings }, name) => name === null ? exports : bindings.find(([key]) => key === name)?.[1],
    module: (_, imports, module) => ok(resolved(lowered(imports)(module))),
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
