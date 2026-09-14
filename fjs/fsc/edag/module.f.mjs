/**
 * A module as an EDAG over its imports, compiled before any import is read:
 * the first half of Stage 1 in `../todo/compile-modules-to-edag.md`, the
 * second being the resolution that binds each import's own EDAG in place of
 * its parameter.
 *
 * @module
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { AstConst, AstMember, AstModule } from '../ast/types.ts'
 * @import { ParseError } from '../parser/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unresolved } from './types.ts'
 * @import { _Nodes } from './private.ts'
 */

import { unreached } from '../ast/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

const args = /** @type {const} */ (['args'])

/** `undefined` is tagged in an EDAG, because a bare one is a missing tuple position. */
const undefinedNode = /** @type {const} */ (['undefined'])

/** Import `i` as the module's EDAG sees it: a property of the arguments. @type {(specifier: string, i: number) => Exp} */
const parameter = (_, i) => ['.', args, i]

/** @type {(lower: (ast: AstConst) => Exp) => (member: AstMember) => readonly [':', string, Exp]} */
const property = lower => ([key, value]) => [':', key, lower(value)]

/**
 * One entry's EDAG. A reference is the node it names — a `const` is one
 * node however many references reach it, which is how the sharing a module
 * spells survives into the graph — and an object's members are written as
 * they stand, a repeated key twice, since the constructor applies them in
 * order and the later wins.
 *
 * @type {(nodes: _Nodes) => (ast: AstConst) => Exp}
 */
const lower = nodes => ast => {
    if (ast === undefined) { return undefinedNode }
    if (ast === null || typeof ast !== 'object') { return ast }
    switch (ast[0]) {
        case 'aref': { return nodes.parameters[ast[1]] }
        case 'cref': { return nodes.consts[ast[1]] }
        case 'array': { return ['[]', ast[1].map(lower(nodes))] }
        default: { return ['{}', ast[1].map(property(lower(nodes)))] }
    }
}

/** @type {(parameters: readonly Exp[]) => (consts: readonly Exp[], ast: AstConst) => readonly Exp[]} */
const entry = parameters => (consts, ast) => [...consts, lower({ parameters, consts })(ast)]

/** A refusal with no position: the module parsed, and what it lacks has no token. @type {(message: string) => Result<never, ParseError>} */
const refuse = message => error({ message, metadata: null })

/**
 * The module as an EDAG over its imports, or the refusal. The body is
 * lowered entry by entry, each `cref` taking the node of the entry it
 * names, and the last entry's node is the export.
 *
 * Refused is a module whose export does not reach every import and every
 * `const`: `transpile` reads each import and `run` evaluates each entry
 * whether the export needs them or not, so a missing file or a bad module
 * behind an unused import fails the compile today, and an EDAG that follows
 * references alone would drop it without a word. The issue keeps that
 * behaviour by refusing the module until EDAG can anchor a computation
 * whose value nothing takes; nothing decides here whether the dropped
 * part could fail, only whether it is reached.
 *
 * @type {(module: AstModule) => Result<Unresolved, ParseError>}
 */
export const unresolved = module => {
    const [specifiers, body] = module
    const { consts, imports } = unreached(module)
    if (imports.length !== 0) { return refuse(`unreachable import "${specifiers[imports[0]]}"`) }
    if (consts.length !== 0) { return refuse(`unreachable const ${consts[0]}`) }
    const nodes = body.reduce(entry(specifiers.map(parameter)), [])
    return ok({ imports: specifiers, edag: nodes[nodes.length - 1] })
}
