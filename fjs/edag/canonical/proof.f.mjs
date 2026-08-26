/**
 * What `canonical` accepts and rejects. Every legal spelling in the
 * Encodings table of `../README.md` appears under `encodings`; every
 * rejected one is grouped by the condition it violates, and the duplicate
 * spelling it loses to is named beside it — a rejection is only justified
 * when the survivor is fully equivalent, so the comment is part of the
 * claim.
 *
 * `validate(exp)` accepts every value here, legal or not: shape is all it
 * checks. `../proof.f.mjs`'s `optionChain.shapeAcceptsWhatCanonicalRejects`
 * is the other half of that pair.
 *
 * @import { Exp, Lambda } from '../types.ts'
 * @import { ChainMessage } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { canonical } from './module.f.mjs'

/** @type {(e: Exp) => void} */
const ok = e => { assertEq(canonical(e)[0], 'ok', 'expected a canonical graph') }

/** @type {(message: ChainMessage) => (e: Exp) => void} */
const rejected = message => e => {
    const [kind, value] = canonical(e)
    assertEq(kind, 'error', 'expected a rejection')
    assertEq(
        /** @type {{ readonly message: ChainMessage }} */(value).message,
        message)
}

/**
 * A node carrying an element past its declared operands. Runtime-valid —
 * rtti tuples are open — but not assignable to `Exp`, whose static tuples
 * are closed: the rendering approximation `../README.md` records under
 * Caveats. The cast is that gap, not a claim about the value.
 * The parameter is `unknown[]` rather than `Exp[]` because the operand
 * arrays a container declares are not `Exp`s either — the same reason
 * `validate` takes an `Unknown`.
 * @type {(node: readonly unknown[]) => Exp}
 */
const openExp = node => /** @type {Exp} */ (node)

/** The same gap, one level in, for a chain step. @type {(step: readonly unknown[]) => Lambda} */
const openLambda = step => /** @type {Lambda} */ (step)

const tooFewSteps = rejected('too few steps')
const deadPrefix = rejected('a dead prefix before the region')
const cutInside = rejected('a cut inside the region')
const trailingCall = rejected('a trailing call step')

export const proof = {
    // The pure nodes carry no conditions at all: there is no `lambdas` to
    // bound, so every shape the schema accepts is a legal graph.
    pure: () => {
        ok(1)
        ok(['.', 'a', 'b'])
        ok(['()', 'a', 'b'])
        ok(['.()', 'a', 'b', 'c'])
        ok(['?.', 'a', 'b'])
        ok(['?.()', 'a', 'b'])
        ok(['[]', [1, ['...', 2]]])
        ok(['{}', [[':', 'a', 1], ['...', 2]]])
        ok([',', [1, 2]])
        ok(['args'])
        ok(['neg', 1])
        ok(['+', 1, 2])
    },
    // The Encodings table, walker by walker.
    encodings: () => {
        ok(['_', 'a', [['|?.', 'b'], ['|.', 'c']]]) // a?.b.c
        ok(['_', 'a', [['|?.', 'b'], ['|()', 'c']]]) // a?.b(...c)
        ok(['_', 'a', [['|.', 'b'], ['|?.()', 'c']]]) // a.b?.(...c)
        ok(['_', 'a', [['|?.', 'b'], ['|?.()', 'c']]]) // a?.b?.(...c)
        ok(['_', 'a', [['|?.()', 'b'], ['|()', 'c']]]) // a?.(...b)(...c)
        ok(['_', 'a', [['|.', 'b'], ['|?.()', 'c'], ['|.', 'd']]]) // a.b?.(...c).d
        // ((a?.b).c)?.(...d) — a `|.` may precede an optional step when it
        // supplies the receiver that step consumes.
        ok(['_', ['?.', 'a', 'b'], [['|.', 'c'], ['|?.()', 'd']]])
        // a?.b(...c).d(...e) — one region holding two receiver lifetimes,
        // and not splittable after the first call.
        ok(['_', 'a', [['|?.', 'b'], ['|()', 'c'], ['|.', 'd'], ['|()', 'e']]])
        ok(['_()', 'a', [['|?.', 'b']], 'c']) // (a?.b)(...c)
        ok(['_()', 'a', [['|?.', 'b'], ['|.', 'c']], 'd']) // (a?.b.c)(...d)
    },
    // A walker is checked wherever it sits, since a graph is a graph: under
    // a container, under an operator, in a step's operand, and in the other
    // walker's base and arguments.
    reachedAnywhere: () => {
        const bad = /** @type {Exp} */ (['_', 'a', [['|?.', 'b']]])
        tooFewSteps(['()', bad, 'b'])
        tooFewSteps(['[]', [1, bad]])
        tooFewSteps(['[]', [['...', bad]]])
        tooFewSteps(['{}', [[':', 'k', bad]]])
        tooFewSteps(['{}', [['...', bad]]])
        tooFewSteps([',', [bad]])
        tooFewSteps(['neg', bad])
        tooFewSteps(['+', 1, bad])
        tooFewSteps(['.', bad, 'k'])
        tooFewSteps(['.()', 'a', 'b', bad])
        tooFewSteps(['?.()', bad, 'b'])
        tooFewSteps(['_', bad, [['|?.', 'b'], ['|.', 'c']]])
        tooFewSteps(['_', 'a', [['|?.', 'b'], ['|()', bad]]])
        tooFewSteps(['_()', 'a', [['|?.', 'b']], bad])
        // A graph with several violations reports one of them, not a list.
        tooFewSteps(['[]', [bad, bad]])
    },
    // Cardinality: without it a walker respells a pure node.
    cardinality: () => {
        tooFewSteps(['_', 'a', []])
        tooFewSteps(['_', 'a', [['|?.', 'b']]]) // ['?.', a, b]
        tooFewSteps(['_', 'a', [['|.', 'b']]]) // ['.', a, b]
        tooFewSteps(['_()', 'a', [], 'c']) // ['()', a, c]
    },
    // Minimality, front cut: nothing is guarded before the region opens, so
    // every step that does no required work leaves into the base, where it
    // is an `exp` other nodes can share.
    deadPrefix: () => {
        // a.b.c?.(...d) — only `|.c` supplies the receiver `|?.()` consumes;
        // `|.b` becomes ['_', ['.', a, b], [['|.', c], ['|?.()', d]]].
        deadPrefix(['_', 'a', [['|.', 'b'], ['|.', 'c'], ['|?.()', 'd']]])
        // a.b.c(...d) with a dead lifetime — the first step's receiver is
        // overwritten before anything consumes it: ['.()', ['.', a, b], c, d].
        deadPrefix(['_()', 'a', [['|.', 'b'], ['|.', 'c']], 'd'])
        // a.b(...c)?.d — the prefix is a completed receiver lifetime, so it
        // is a `.()` node: ['?.', ['.()', a, b, c], d].
        deadPrefix(['_', 'a', [['|.', 'b'], ['|()', 'c'], ['|?.', 'd']]])
        // (a.b(...c)?.d)(...e) — the same cut, in the middle of a `_()`:
        // ['_()', ['.()', a, b, c], [['|?.', d]], e].
        deadPrefix(['_()', 'a', [['|.', 'b'], ['|()', 'c'], ['|?.', 'd']], 'e'])
        // A `|.` may precede only a `|?.()`, which consumes it; a `|?.`
        // consumes nothing, so ['_', ['.', a, b], [['|?.', c], …]] is shorter.
        deadPrefix(['_', 'a', [['|.', 'b'], ['|?.', 'c']]])
        // A lone `|.` in a `_()` is a receiver lifetime with no region at
        // all: ['.()', a, b, c].
        deadPrefix(['_()', 'a', [['|.', 'b']], 'c'])
    },
    // Minimality, inside cut: a cut is available before any optional step
    // that takes no receiver from the step before it.
    cutInside: () => {
        // a?.b?.c — a `|?.` is always a cut: ['?.', ['?.', a, b], c].
        cutInside(['_', 'a', [['|?.', 'b'], ['|?.', 'c']]])
        // a?.b(...c)?.d — the cut is in the middle:
        // ['?.', ['_', a, [['|?.', b], ['|()', c]]], d].
        cutInside(['_', 'a', [['|?.', 'b'], ['|()', 'c'], ['|?.', 'd']]])
        // a?.b(...c)?.d.e — the cut is at the back, and the trailing `|.` is
        // not liftable on its own; the guarded suffix it sits in lifts whole.
        cutInside(['_', 'a', [
            ['|?.', 'b'], ['|()', 'c'], ['|?.', 'd'], ['|.', 'e'],
        ]])
        // a?.(...b)?.(...c) — a `|?.()` after a call step takes no receiver
        // either: ['?.()', ['?.()', a, b], c].
        cutInside(['_', 'a', [['|?.()', 'b'], ['|?.()', 'c']]])
        // ... and the same after a plain call step.
        cutInside(['_', 'a', [['|?.()', 'b'], ['|()', 'c'], ['|?.()', 'd']]])
        // A `_()` is cut the same way; only its own trailing call is special.
        cutInside(['_()', 'a', [['|?.', 'b'], ['|()', 'c'], ['|?.', 'd']], 'e'])
    },
    // Only *declared* operands are walked. Tuples are open, so an element
    // past a node's arity is data the node never evaluates: `validate`
    // ignores it, and reading it here would reject a runtime-valid graph
    // for what its ignored tail happens to hold — or, on a malformed tail,
    // fail to answer at all. Each case below carries the same non-canonical
    // walker `reachedAnywhere` rejects in a declared position.
    openTails: () => {
        const bad = /** @type {Exp} */ (['_', 'a', [['|?.', 'b']]])
        // The three operation arities, which is what decides how much of a
        // tuple is declared: `op0` none, `op1` one, `op2` two.
        ok(openExp(['args', bad]))
        ok(openExp(['neg', 1, bad]))
        ok(openExp(['+', 1, 2, bad]))
        // ... and every chain node, whose arities the tags carry.
        ok(openExp(['.', 'a', 'b', bad]))
        ok(openExp(['()', 'a', 'b', bad]))
        ok(openExp(['.()', 'a', 'b', 'c', bad]))
        ok(openExp(['?.', 'a', 'b', bad]))
        ok(openExp(['?.()', 'a', 'b', bad]))
        ok(openExp(['_', 'a', [['|?.', 'b'], ['|.', 'c']], bad]))
        ok(openExp(['_()', 'a', [['|?.', 'b']], 'c', bad]))
        // The containers hold their operands in one declared array, so a
        // tail sits past that array rather than among its elements.
        ok(openExp(['[]', [1], bad]))
        ok(openExp(['{}', [], bad]))
        ok(openExp([',', [1, 2], bad]))
        // A step has an open tail of its own, read the same way: its
        // operand is at one declared position and the rest is tail.
        ok(['_', 'a', [openLambda(['|?.', 'b', bad]), ['|.', 'c']]])
        // A tail too short to be a node of its own is still just a tail —
        // reading one would throw rather than report.
        ok(openExp(['args', openExp(['_'])]))
    },
    // Minimality, the far end: `_()`'s own call takes the last step's
    // receiver, so a trailing call step — which already cleared one — leaves
    // it nothing to consume.
    trailingCall: () => {
        // (a?.(...b))(...c) — ['()', ['?.()', a, b], c].
        trailingCall(['_()', 'a', [['|?.()', 'b']], 'c'])
        // (a?.b(...c))(...d) — ['()', ['_', a, [['|?.', b], ['|()', c]]], d].
        trailingCall(['_()', 'a', [['|?.', 'b'], ['|()', 'c']], 'd'])
    },
}
