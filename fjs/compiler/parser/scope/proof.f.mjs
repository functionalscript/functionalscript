/**
 * Source scopes retain lexical identity, ordered evidence and capture ownership.
 *
 * @import { BindingId } from '../../../js/ast/types.ts'
 * @import { ModuleTokenWithMetadata } from '../../tokenizer/types.ts'
 * @import { _Capture, _Plan, _Scope } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { at, empty, setReplace } from '../../../types/ordered_map/module.f.js'
import {
    _completedTrace, _declared, _initialized, _isVariable, _moduleScope,
    _planOrigins, _regionScope, _restoredScope, _sourceBinding, _traced,
} from './module.f.mjs'

/** A declaration token with a distinct diagnostic position. @type {(name: string, column: number) => ModuleTokenWithMetadata} */
const token = (name, column) => ({ token: { kind: 'id', value: name }, metadata: { path: '/scope.f.js', line: 1, column }, newline: false })

/** A named read gives the proof one lexical identity and its declaration origin. @type {(name: string, index: number) => _Plan} */
const namedPlan = (name, index) => ({
    reads: [{ source: null, spread: false }], ids: [_sourceBinding(index)],
    names: [[token(name, index + 1), 0]], metadata: token(name, index + 1).metadata,
})

/** Pending and escaped captures keep the original write diagnostic. @type {(id: BindingId, escaped: boolean, written: boolean) => _Capture} */
const capture = (id, escaped, written) => ({
    id, escaped, written, refusal: { message: 'reassigned variable captured', metadata: token('read', 1).metadata },
})

export const proof = {
    bindingsAreFreshAndTraceBatchesKeepSourceOrder: () => {
        const first = _sourceBinding(0)
        const sameIndex = _sourceBinding(0)
        const second = _sourceBinding(1)
        assertEq(first.index, sameIndex.index)
        assert(first !== sameIndex)
        const root = _moduleScope()
        assertEq(root.outer, null)
        assertEq(root.region, false)
        assertEq(root.inFunction, false)
        assertEq(root.names, empty)
        assertEq(root.origins, empty)
        assertStructurallySame(_completedTrace(root), { target: root.trace.target, bindings: [], events: [] })
        assert(root.trace.target !== _moduleScope().trace.target)
        const initialized = _traced(root, [['initialize', first], ['read', first]])
        const written = _traced(initialized, [['write', second]])
        assertStructurallySame(_completedTrace(written), {
            target: root.trace.target, bindings: [], events: [['initialize', first], ['read', first], ['write', second]],
        })
        assertEq(written.trace.target, root.trace.target)
        assertEq(written.trace.count, 3)
        assertEq(initialized.trace.count, 2)
        assertEq(root.trace.count, 0)
        assertStructurallySame(_completedTrace(root).events, [])
    },
    originsDistinguishHiddenReadsAndNamedDeclarations: () => {
        const ids = [0, 1, 2, 3, 4].map(_sourceBinding)
        const left = token('left', 7)
        const right = token('right', 15)
        const metadata = token('pattern', 3).metadata
        /** @type {_Plan} */
        const plan = {
            reads: ids.map(() => ({ source: null, spread: false })), ids,
            names: [[left, 1], [right, 3]], metadata,
        }
        for (const [kind, variable] of /** @type {const} */ ([['const', false], ['let', true], ['parameter', true]])) {
            const origins = _planOrigins(plan, kind)
            assertStructurallySame(origins, [
                { id: ids[0], name: null, kind: 'temporary', metadata },
                { id: ids[1], name: 'left', kind, metadata: left.metadata },
                { id: ids[2], name: null, kind: 'temporary', metadata },
                { id: ids[3], name: 'right', kind, metadata: right.metadata },
                { id: ids[4], name: null, kind: 'temporary', metadata },
            ])
            assertEq(origins[1].id, ids[1])
            assertEq(origins[1].metadata, left.metadata)
            assertEq(origins[4].metadata, metadata)
            assertEq(_isVariable(kind), variable)
        }
        const preceding = namedPlan('left', 10)
        const root = _declared(_moduleScope(), preceding, 'let')
        const declared = _declared(root, plan, 'const')
        assertStructurallySame(declared.trace.bindings, [...preceding.ids, ...ids])
        assertStructurallySame(declared.sourceOrigins, [...root.sourceOrigins, ..._planOrigins(plan, 'const')])
        assertEq(at('left')(declared.names), null)
        assertEq(at('right')(declared.names), null)
        assertStructurallySame(_completedTrace(declared).events, [])
        const initialized = _initialized(declared, plan)
        assertStructurallySame(_completedTrace(initialized).events, ids.map(id => ['initialize', id]))
        assertEq(at('left')(initialized.origins), ids[1])
        assertEq(at('right')(initialized.origins), ids[3])
        /** @type {_Plan} */
        const vacant = { reads: [], ids: [], names: [], metadata }
        assertStructurallySame(_planOrigins(vacant, 'let'), [])
        assertStructurallySame(_declared(root, vacant, 'let').sourceOrigins, root.sourceOrigins)
    },
    initializationUpdatesOriginsWithoutChangingDeclarationIdentity: () => {
        const previous = namedPlan('value', 0)
        const root = _initialized(_declared(_moduleScope(), previous, 'let'), previous)
        const replacement = namedPlan('value', 1)
        const declared = _declared(root, replacement, 'const')
        const initialized = _initialized(declared, replacement)
        assertEq(at('value')(root.origins), previous.ids[0])
        assertEq(at('value')(initialized.origins), replacement.ids[0])
        assertEq(initialized.names, declared.names)
        assertEq(initialized.trace.bindings, declared.trace.bindings)
        assertStructurallySame(_completedTrace(initialized).events, [
            ['initialize', previous.ids[0]], ['initialize', replacement.ids[0]],
        ])
        assertEq(initialized.trace.count, 2)
        /** @type {_Plan} */
        const vacant = { reads: [], ids: [], names: [], metadata: token('empty', 1).metadata }
        const unchanged = _initialized(initialized, vacant)
        assertEq(unchanged.origins, initialized.origins)
        assertStructurallySame(_completedTrace(unchanged), _completedTrace(initialized))
    },
    regionsShareTheirFunctionOwnerAndIsolateLocalSetup: () => {
        const root = _moduleScope()
        const id = _sourceBinding(3)
        const names = setReplace('local')(/** @type {const} */ ({ id, kind: 'own', assignable: true }))(empty)
        const enclosing = { first: names, tail: null }
        const moduleRegion = _regionScope(root, names, enclosing)
        assertEq(moduleRegion.outer, root)
        assertEq(moduleRegion.names, names)
        assertEq(moduleRegion.enclosing, enclosing)
        assertEq(moduleRegion.inFunction, false)
        assertEq(moduleRegion.region, true)
        assertEq(moduleRegion.trace.target, root.trace.target)
        /** @type {_Scope} */
        const fn = { ..._traced(root, [['read', id]]), inFunction: true, self: 'owner', selfBinding: id, selfVariable: true, blockCall: true }
        const region = _regionScope(fn, empty, null)
        assertEq(region.inFunction, true)
        assertEq(region.trace.target, fn.trace.target)
        assertEq(region.origins, empty)
        assertEq(region.self, null)
        assertEq(region.selfBinding, null)
        assertEq(region.selfVariable, false)
        assertEq(region.blockCall, false)
        assertEq(region.trace.count, 0)
        assertStructurallySame(region.captures, [])
        assertStructurallySame(region.sourceOrigins, [])
        assertStructurallySame(_completedTrace(region).events, [])
    },
    restoringRegionsKeepsEscapedCapturesAndOutwardEvidence: () => {
        const outerPlan = namedPlan('outer', 1)
        const localPlan = namedPlan('local', 2)
        const external = _sourceBinding(3)
        const preceding = capture(outerPlan.ids[0], false, false)
        /** @type {_Scope} */
        const outer = { ..._initialized(_declared(_moduleScope(), outerPlan, 'const'), outerPlan), captures: [preceding] }
        const local = capture(localPlan.ids[0], false, false)
        const escaped = capture(localPlan.ids[0], true, true)
        const outward = capture(external, false, true)
        /** @type {_Scope} */
        const region = {
            ..._traced(_initialized(_declared(_regionScope(outer, empty, null), localPlan, 'let'), localPlan), [['read', external]]),
            captures: [local, escaped, outward],
        }
        const restored = _restoredScope(region, false)
        assertEq(restored.outer, outer.outer)
        assertEq(restored.trace.target, outer.trace.target)
        assertStructurallySame(restored.trace.bindings, [...outerPlan.ids, ...localPlan.ids])
        assertStructurallySame(restored.sourceOrigins, [...outer.sourceOrigins, ...region.sourceOrigins])
        assertStructurallySame(_completedTrace(restored).events, [
            ['initialize', outerPlan.ids[0]], ['region', [['initialize', localPlan.ids[0]], ['read', external]]],
        ])
        assertEq(restored.trace.count, outer.trace.count + 1)
        assertStructurallySame(restored.captures, [preceding, escaped, outward])
        assertEq(restored.captures[1], escaped)
        assertEq(restored.captures[2], outward)
        assertStructurallySame(outer.captures, [preceding])
    },
    restoringFunctionsKeepsTheirBindingsSeparateAndMarksHeldCaptures: () => {
        const outerPlan = namedPlan('outer', 1)
        const localPlan = namedPlan('parameter', 2)
        const external = _sourceBinding(3)
        const preceding = capture(outerPlan.ids[0], false, false)
        /** @type {_Scope} */
        const outer = { ..._initialized(_declared(_moduleScope(), outerPlan, 'let'), outerPlan), captures: [preceding] }
        const local = capture(localPlan.ids[0], false, false)
        const escaped = capture(localPlan.ids[0], true, true)
        const outward = capture(external, false, true)
        /** @type {_Scope} */
        const fn = {
            ..._traced(_initialized(_declared(_moduleScope(), localPlan, 'parameter'), localPlan), [['write', external]]),
            outer, inFunction: true, captures: [local, escaped, outward],
        }
        const immediate = _restoredScope(fn, false)
        assertEq(immediate.trace.bindings, outer.trace.bindings)
        assertEq(immediate.trace.target, outer.trace.target)
        assert(fn.trace.target !== outer.trace.target)
        assertStructurallySame(_completedTrace(immediate).events, [
            ['initialize', outerPlan.ids[0]], ['function', _completedTrace(fn)],
        ])
        assertStructurallySame(immediate.captures, [preceding, escaped, outward])
        const held = _restoredScope(fn, true)
        assertStructurallySame(held.captures, [preceding, escaped, { ...outward, escaped: true }])
        assertEq(held.captures[0], preceding)
        assertEq(held.captures[2].id, external)
        assertEq(held.captures[2].refusal, outward.refusal)
        assertEq(outward.escaped, false)
        assertStructurallySame(held.sourceOrigins, [...outer.sourceOrigins, ...fn.sourceOrigins])
    },
    throw: {
        aRootScopeCannotBeRestoredWithoutItsOwner: () => { _restoredScope(_moduleScope(), false) },
    },
}
