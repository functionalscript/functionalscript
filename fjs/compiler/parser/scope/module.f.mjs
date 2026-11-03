/**
 * Track lexical source regions, declaration origins and capture evidence.
 * Closing a region preserves its owning source function and ordered binding
 * events; closing a held function marks its outward captures as escaped.
 *
 * @module
 * @import { BindingEvent, BindingId, BindingScope } from '../../../js/ast/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { BindingOrigin } from '../types.ts'
 * @import { _DeclarationKind, _Env, _Plan, _Scope } from '../private.ts'
 */

import { concat, reverse } from '../../../types/list/module.f.js'
import { toArray } from '../../../types/list/alt/module.f.js'
import { empty, setReplace } from '../../../types/ordered_map/module.f.js'
import { assertNotNullish } from '../../../asserts/module.f.js'
import { nameOf } from '../syntax/module.f.mjs'

/** Source identity is independent of the value its initialization computes. @type {(index: number) => BindingId} */
export const _sourceBinding = index => ({ index })

/** @type {(scope: _Scope, events: readonly BindingEvent[]) => _Scope} */
export const _traced = (scope, events) => ({ ...scope, trace: { ...scope.trace, events: concat(scope.trace.events)(events), count: scope.trace.count + events.length } })

/** Materialize ordered evidence once at a source function or region boundary. @type {(scope: _Scope) => BindingScope} */
export const _completedTrace = scope => ({ target: scope.trace.target, bindings: scope.trace.bindings, events: toArray(scope.trace.events) })

/** @type {(plan: _Plan, kind: _DeclarationKind) => readonly BindingOrigin[]} */
export const _planOrigins = (plan, kind) => {
    /** @type {List<BindingOrigin>} */
    let origins = null
    let named = 0
    // Names follow their read indices, so each name and hidden read is visited once.
    for (let index = 0; index < plan.ids.length; index += 1) {
        const entry = plan.names[named]
        const name = entry !== undefined && entry[1] === index ? entry[0] : undefined
        if (name !== undefined) { named += 1 }
        origins = { first: { id: plan.ids[index], name: name === undefined ? null : nameOf(name), kind: name === undefined ? 'temporary' : kind, metadata: name?.metadata ?? plan.metadata }, tail: origins }
    }
    return toArray(reverse(origins))
}

/** Declare before initialization without making the name readable in its TDZ. @type {(scope: _Scope, plan: _Plan, kind: _DeclarationKind) => _Scope} */
export const _declared = (scope, plan, kind) => ({ ...scope, trace: { ...scope.trace, bindings: [...scope.trace.bindings, ...plan.ids] }, sourceOrigins: [...scope.sourceOrigins, ..._planOrigins(plan, kind)] })

/** Whether a declaration's names are variables, which an assignment may rebind: a `let`'s and a parameter's. @type {(kind: _DeclarationKind) => boolean} */
export const _isVariable = kind => kind !== 'const'

/** Initialize each expanded identity once; aliases retain separate source IDs. @type {(scope: _Scope, plan: _Plan) => _Scope} */
export const _initialized = (scope, plan) => _traced({
    ...scope,
    origins: plan.names.reduce((origins, [name, index]) => setReplace(nameOf(name))(plan.ids[index])(origins), scope.origins),
}, plan.ids.map(id => ['initialize', id]))

/** @type {() => _Scope} */
export const _moduleScope = () => ({
    names: empty, origins: empty, count: 0, parameters: [], rest: null, enclosing: null, outer: null,
    self: null, selfBinding: null, selfVariable: false, captures: [], region: false, inFunction: false, blockCall: false,
    trace: { target: { kind: 'function', index: 0 }, bindings: [], events: null, count: 0 }, sourceOrigins: [],
})

/** A lexical region shares its source function target. @type {(outer: _Scope, names: _Env, enclosing: List<_Env>) => _Scope} */
export const _regionScope = (outer, names, enclosing) => ({
    names, origins: empty, count: 0, parameters: [], rest: null, enclosing, outer, self: null, selfBinding: null, selfVariable: false, captures: [], region: true, inFunction: outer.inFunction, blockCall: false,
    trace: { target: outer.trace.target, bindings: [], events: null, count: 0 }, sourceOrigins: [],
})

/**
 * Merge complete source evidence at a lexical boundary. The captures the
 * scope holds, still pending, of bindings it declares itself are decided:
 * harmless, since the function that made them was called inside the
 * binding's scope. The rest pass to the outer scope after the outer's own,
 * in document order — pending still, unless the scope is a function `held`
 * as a value, which makes them escaped. Source admission checks those
 * escaped captures against writes to their bindings.
 *
 * @type {(scope: _Scope, held: boolean) => _Scope}
 */
export const _restoredScope = (scope, held) => {
    const outer = assertNotNullish(scope.outer, 'a source region without its enclosing scope')
    const trace = _completedTrace(scope)
    /** @type {BindingEvent} */
    const event = scope.region ? ['region', trace.events] : ['function', trace]
    const kept = scope.captures.filter(capture => capture.escaped || !trace.bindings.includes(capture.id))
    return {
        ..._traced({ ...outer, trace: scope.region ? { ...outer.trace, bindings: [...outer.trace.bindings, ...trace.bindings] } : outer.trace }, [event]),
        sourceOrigins: [...outer.sourceOrigins, ...scope.sourceOrigins],
        captures: [...outer.captures, ...(held ? kept.map(capture => ({ ...capture, escaped: true })) : kept)],
    }
}

