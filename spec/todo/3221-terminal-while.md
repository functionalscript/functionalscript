## A terminal unconditional loop

**Priority:** P2
**Status:** wip — approved; implementation in progress

### Problem

A final `while (true)` with no break targeting that loop cannot complete
normally, yet the function-body grammar still requires a following return or
throw. A function such as `repeat` in
[`fjs/common/monoid`](../../fjs/common/monoid/module.f.mjs) returns explicitly
from its unconditional loop. Making that return a break and adding a return
after the loop satisfies the current grammar, but the original already has
an explicit result on every returning path.

The [reachable-block-end issue](./3210-reachable-block-end.md) preserves the
refusal of functions that silently fall through their closing brace and return
`undefined`. A structurally unreachable end is a different case: the
[loop specification](../control-flow/loops/README.md) already admits divergence.

### Proposal

Recognize a final unconditional loop as a terminating statement in a source
function's block body, including an existing terminating guard or case block
in that function, when both conditions hold:

- The condition is the boolean literal `true`. Parentheses around that literal
  are transparent; `1`, `!false`, `true || value`, and a constant reference are
  not admitted by this rule. It performs no constant folding or truthiness
  inference.
- No source `break` targets that loop. Resolve existing loop and switch target
  identities before testing this condition, and inspect all source branches,
  including text after a return or throw. An unreachable
  `if (false) { break; }` still disqualifies the loop; source admission does
  not use an optimizer to erase the evidence.

```js
export default n => {
    let count = n;
    while (true) {
        if (count === 0) { return count; }
        count = count - 1;
    }
};
```

A returning path returns explicitly. Other paths may throw or continue
indefinitely. The rule proves that the closing brace cannot be reached by
normal completion; it does not prove that every execution returns, nor add a
termination requirement to FunctionalScript.

#### Transfer ownership

An inner loop's break leaves that inner loop, not the terminal outer loop.
A switch-local break leaves that switch. Both remain allowed:

```js
export default condition => {
    while (true) {
        while (condition) { break; }
        switch (condition) {
            case true: { break; }
            default: { return 0; }
        }
        if (condition) { return 1; }
    }
};
```

An owning-function `return`, a `throw`, or a `continue` targeting the loop does
not permit normal completion and remains allowed. Nested functions retain
their own return and transfer ownership. No break or continue may cross a
function boundary, and existing refusals of labeled transfers are unchanged.

For contrast, this function still needs a terminator after its loop because
the break targets that loop:

```js
export default condition => {
    while (true) {
        if (condition) { break; }
    }
};
```

#### Source admission and normalization

The syntax reader retains a candidate final loop. Source admission resolves
control targets and verifies the literal condition and absence of a break to
that target before desugaring. An unrelated break elsewhere in a nested body
is not grounds for refusal. The existing `hasLoopTransfer` helper is not a
drop-in predicate: it detects continues as well as breaks, whereas a continue
does not disqualify this rule.

Keep ordinary declaration, binding and capture checks over all source text,
including unreachable branches. A candidate loop with an illegal reference or
capture remains refused even when execution would never reach that text.

Normalization must preserve the absence of normal completion. It must not
invent an implicit returned `undefined`, intercept a return belonging to the
source function, or create an executable continuation after the terminal loop.
Use the existing loop/control operations; no new EDAG or VM primitive is
proposed. Serializers may emit a terminal loop without a trailing return.

Module loops keep their existing rules and do not replace the module's
required exports or terminal throw. This proposal does not admit a normally
completing function body, generalized constant-condition analysis, assignment
expressions, `for` syntax, or labeled transfers.

### Benefits and drawbacks

**Benefits.** Preserve familiar JavaScript control flow, accept an already
explicit return inside an unconditional loop, and remove a migration rewrite
without weakening the guarantee against accidental implicit `undefined`.
The same rule handles deliberate divergence without pretending that it must
produce a result.

**Drawbacks.** The grammar must retain candidate final loops and source
admission must inspect resolved break targets before accepting them as
terminators. A literal condition and conservative source-break check reject
some loops that a broader control-flow analysis could prove non-fallthrough.
Proofs and serializers must distinguish an absent normal continuation from
one that returns a value.

### Approval

Approved by **sergey-shandar**, distinct from the proposer, in the
[working session](https://chatgpt.com/local/01a18594-4211-744b-b07a-aaed2279400e).
After reviewing proposal PR #3417, the designer said, "Implement it in a new
PR stacked on top of 3417". This is the explicit implementation approval
required under
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo).

### Tasks

- [x] Record explicit language-design approval.
- [ ] Retain candidate terminal loops in syntax and resolve their transfer
  targets under ordinary source admission.
- [ ] Admit the final literal-true loop only when no source break targets it;
  preserve declaration, reference and capture checks in unreachable text.
- [ ] Preserve terminal-loop control through normalization and output without
  implicit results, executable post-loop continuations or new VM operations.
- [ ] Prove explicit returns after several iterations, throws, outer continues,
  terminal guard/case blocks, and nested-loop and switch-local breaks.
- [ ] Prove refusals for an owning-loop break, an unreachable owning-loop
  break, a nonliteral condition, and ordinary reachable function-body ends.
- [ ] Check deliberate divergence structurally without running an infinite
  test, and prove ordinary loops followed by a return remain unchanged.
- [ ] Update the implemented function/loop specification and migration guidance
  when the feature lands; delete this issue after all tasks complete.

### Related

- [A block whose end is reachable](./3210-reachable-block-end.md) — the existing
  explicit-result guarantee this rule preserves.
- [Let statement](./3220-let.md) — general loop and transfer semantics.
- [Compound assignments](./3430-assignments.md) — separate syntax work used by
  the monoid helper; it is not a prerequisite for the terminal-loop rule.
