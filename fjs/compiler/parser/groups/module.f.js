/**
 * Resolve the consecutive named function declarations in a lexical block.
 * A forward read is admitted exactly when the declarations spanning it make
 * one strongly connected component. Dependencies are resolved captures, so
 * parameter shadowing and references inside nested closures need no syntax walk.
 *
 * @module
 * @import { BindingId } from '../../../js/ast/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { ParseError } from '../types.ts'
 * @import { Const, Let } from '../syntax/types.ts'
 * @import { _FunctionRun, _Plan, _Ref, _Scope } from '../scope/types.ts'
 */
import { empty, setReplace } from '../../../types/ordered_map/module.f.js'
import { ok, error } from '../../../types/result/module.f.js'
import { nameOf } from '../syntax/module.f.js'
import { isFunctionGroup } from '../../../edag/group/module.f.js'
import { _sourceBinding } from '../scope/module.f.js'

/** @type {(declaration: Const | Let) => string | null} */
export const functionName = declaration => declaration.target[0] === 'name' && declaration.value?.[0] === '=>'
    ? nameOf(declaration.target[1]) : null

/** Save a member's resolved dependencies on other declarations in its run. @type {(outer: _Scope, fn: _Scope) => _Scope} */
export const memberClosed = (outer, fn) => {
    const run = outer.run
    if (run === undefined || fn.selfBinding === null) { return outer }
    const from = fn.selfBinding.index
    const edges = fn.captures.flatMap(({ id, refusal }) => run.ids[Number(id.index)] === id
        ? [{ from, to: id.index, metadata: refusal.metadata }] : [])
    return { ...outer, run: { ...run, edges: [...run.edges, ...edges] } }
}

/** Partition at the earliest complete definition. Only spans containing a
 * forward read need the two reachability checks. @type {(run: _FunctionRun) => Result<readonly (readonly BindingId[])[], ParseError>} */
const partition = run => {
    /** @type {readonly (readonly BindingId[])[]} */
    let groups = []
    let next = 0
    for (const forward of run.edges) {
        const start = forward.from
        if (start < next || forward.to <= start) { continue }
        let last = forward.to
        for (let i = start; i <= last; i += 1) {
            for (const edge of run.edges) {
                if (edge.from === i && edge.to > last) { last = edge.to }
            }
        }
        if (!isFunctionGroup(start, last, run.edges)) {
            return error({ message: 'const not found', metadata: forward.metadata })
        }
        groups = [...groups, run.ids.slice(start, last + 1)]
        next = last + 1
    }
    return ok(groups)
}

/** At a statement boundary, finish the preceding run and reserve identities
 * only for consecutively declared functions. Reservations remain separate
 * from initialized names and ordinary duplicate-name checks.
 * @type {(scope: _Scope, index: number, nameAt: (index: number) => string | null) => Result<_Scope, ParseError>}
 */
export const scopeAt = (scope, index, nameAt) => {
    const previous = scope.run
    if (previous !== undefined) {
        if (index < previous.end) { return ok(scope) }
        const [tag, groups] = partition(previous)
        if (tag === 'error') { return error(groups) }
        scope = { ...scope, run: undefined, ...(groups.length === 0 ? {} : { groups: [...scope.groups ?? [], ...groups] }) }
    }
    let word = nameAt(index)
    if (word === null || nameAt(index + 1) === null) { return ok(scope) }
    /** @type {_FunctionRun['names']} */
    let names = empty
    /** @type {readonly BindingId[]} */
    let ids = []
    let end = index
    while (word !== null) {
        const id = _sourceBinding(end - index)
        names = setReplace(word)(/** @type {_Ref} */ ({ id, kind: 'own', assignable: false }))(names)
        ids = [...ids, id]
        end += 1
        word = nameAt(end)
    }
    return ok({ ...scope, run: { names, ids, end, edges: [] } })
}

/** A bare function declaration uses its reserved identity when its own
 * initializer is resolved. @type {(scope: _Scope, index: number, plan: _Plan) => _Plan} */
export const memberPlan = (scope, index, plan) => scope.run === undefined ? plan
    : { ...plan, ids: [scope.run.ids[Number(index - scope.run.end + scope.run.ids.length)]] }
