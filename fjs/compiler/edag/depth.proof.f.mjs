/**
 * Source and normalized FAST depth proofs. Kept separately so each source
 * file remains within the website's published-source size limit.
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { Value as FastValue } from '../../js/ast/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.js'
import { logicalValue } from '../../js/ast/sugar/logical/module.f.js'
import { compile, expectEdag, lowered } from './proof.f.mjs'

/**
 * Confirms `exp` is a left-associative `+` chain `depth` terms deep, bottoming
 * out at `1` — `((1+1)+1)+…`. `validate`/`assertStructurallySame` are
 * themselves recursive (`fjs/edag/todo/stack-safety.md` tracks that, one
 * layer down from this one), so a chain deep enough to prove `lower` stack-safe
 * overflows them before it says anything about `lower`. This walks the same
 * shape iteratively instead, the one comparison this proof needs at a depth
 * the two shared helpers cannot reach.
 * @type {(depth: number) => (exp: Exp) => void}
 */
const expectPlusChain = depth => exp => {
    let node = exp
    let remaining = depth
    while (remaining > 0) {
        assert(Array.isArray(node) && node[0] === '+' && node[2] === 1, node)
        node = node[1]
        remaining = remaining - 1
    }
    assertEq(node, 1)
}

/**
 * Confirms the conditional graph of a left-associative source `&&` chain,
 * with each result reusing its condition and bottoming out at `1`. Walked as
 * {@link expectPlusChain} is, for the same reason.
 * @type {(depth: number) => (exp: Exp) => void}
 */
const expectAndChain = depth => exp => {
    let node = exp
    let remaining = depth
    while (remaining > 0) {
        assert(Array.isArray(node) && node[0] === '?:' && node[2] === 1 && node[3] === node[1], node)
        node = node[1]
        remaining = remaining - 1
    }
    assertEq(node, 1)
}

/**
 * Confirms `exp` is a conditional nested `depth` deep through its else arm
 * — `1 ? 2 : (1 ? 2 : …)` — bottoming out at `3`, walked iteratively as
 * {@link expectPlusChain} is, for the same reason.
 * @type {(depth: number) => (exp: Exp) => void}
 */
const expectElseChain = depth => exp => {
    let node = exp
    let remaining = depth
    while (remaining > 0) {
        assert(Array.isArray(node) && node[0] === '?:' && node[1] === 1 && node[2] === 2, node)
        node = node[3]
        remaining = remaining - 1
    }
    assertEq(node, 3)
}

export const proof = {
    // A chain of operators, as deep as the source that built it: `lower`
    // walks one with an explicit stack rather than recursion, so 5,000
    // terms — the depth `fjs/compiler/parser/proof.f.mjs`'s own `stackSafety`
    // uses — cost no call stack. Left-associative for a binary operator,
    // the EDAG nests on its own left, `((1+1)+1)+…`, checked by
    // `expectPlusChain` rather than `expectEdag` for the reason given on
    // it; right-associative for `-`, on its right, `-(-(-…))`, folding away
    // to the leaf it started from since 5,000 negations is even — a single
    // number, so `expectEdag` never recurses into it.
    stackSafety: () => {
        const plus = `1${' + 1'.repeat(5000)}`
        expectPlusChain(5_000)(compile(`export default ${plus};`).edag)
        const neg = `${'- '.repeat(5000)}1`
        expectEdag(compile(`export default ${neg};`).edag, 1)
        // conversions use the same iterative lowering as prefixes
        /** @type {FastValue} */
        let converted = 1
        for (let i = 0; i < 5_000; i += 1) { converted = ['String', converted] }
        let node = lowered(converted)
        for (let i = 0; i < 5_000; i += 1) {
            assert(node instanceof Array && node[0] === 'String', node)
            node = node[1]
        }
        assertEq(node, 1)
        // a lazy chain, and a conditional nested through its else arm, at
        // the depth the parser's own `lazyStackCost` proves — FAST built
        // here rather than parsed, `lowered`'s own comment has why
        /** @type {FastValue} */
        let and = 1
        for (let i = 0; i < 20_000; i += 1) { and = logicalValue('&&', and, 1) }
        expectAndChain(20_000)(lowered(and))
        /** @type {FastValue} */
        let otherwise = 3
        for (let i = 0; i < 20_000; i += 1) { otherwise = ['?:', 1, 2, otherwise] }
        expectElseChain(20_000)(lowered(otherwise))
    },
}
