## General loops and tail calls

**Priority:** P2
**Status:** open — epic and language proposal; implementation has not started

### Problem

The compiler admits `let` only beside a particular single-variable `while`,
and output recognizes essentially `r => condition ? self(next) : r`.
General rebinding and structured loops need one explicit model of state and
exits, not a growing catalogue of source templates or separate backend rules.

This epic reuses the [compiler architecture](./compiler-vocabulary-and-modularization.md)
and [tail-loop migration](../edag/todo/tail-call-loop.md#fast-migration).
Their tasks remain with those owners. This file coordinates the relevant
prerequisites and the broader language work. Simplicity and separation of
concerns govern the design: source checks own admission, FAST owns structured
control flow, EDAG conversion owns recursive helpers, and serializers own
target spelling. The current implementation is still the
[restricted loop form](../../spec/control-flow/loops.md).

### Proposal

#### Mutable bindings, immutable captures

Allow `let` independently of a loop in every declaration position supported
by the source grammar, including modules, function bodies and nested blocks.
Keep JavaScript's lexical scope and initialization rules. This concerns
binding reassignment; mutation of object contents remains the separate
[mutability design](../../spec/design/mutability.md).

- Every `let` binding is mutable, whether or not it is actually assigned.
- A parameter assigned in its declaring function is mutable throughout that
  function. Classify writes before checking captures, including a capture
  appearing before an assignment. Assignment alone is valid; combining it
  with a capture is the error.
- A mutable binding cannot initialize a nested function's frame. A nested
  read or write is a capture; nested assignment cannot mutate an outer binding.
- `const snapshot = value` binds the current value and may be captured.
  It does not clone an object. A mutable binding does not silently become
  immutable after its last assignment or at the end of a loop.

```js
let x = 5;
x = 6;
const bad = () => x; // rejected: mutable binding captured
```

```js
const g = a => {
    const a0 = a;
    const f = () => a0;
    a = 5;
    return f;
};
```

Admission checks source bindings before optimization can erase a function
boundary. The new rule intentionally replaces the current post-loop `const`
treatment and immediate-call capture exception. Migrate affected source and
proofs to explicit snapshots when the new rule becomes public.

Source mutability need not survive as mutable cells in normalized FAST.
Track the current expression for each binding: assignment creates a fresh
value, and a conditional produces explicit results for the bindings it changes.
Retain required evaluations even when a later assignment overwrites their values.

#### Structured FAST and pass contracts

FAST means Foundation AST, but is a foundation IR rather than a required
subset of JavaScript AST. It has ordinary expressions/functions, immutable
value bindings, structured branches with results, and loops with explicit
state and exits. No new source keyword or EDAG loop node is introduced.

Conceptual FAST, not JavaScript syntax:

```text
result = loop L(a = initialA, b = initialB) {
    if (done(a, b)) {
        break L(a, b)
    }
    continue L(b, a + b)
}
```

| Construct | Meaning |
| --- | --- |
| Loop parameters | Immutable values for the current iteration, initialized at entry. |
| Branch results | Values selected from the executed arm, used after that branch. |
| `continue L(values)` | Establish all next-state values, then start the next iteration of L. |
| `break L(values)` | Complete L with its result values; resume after L. |
| `return F(value)` | Exit the identified source function F, through any enclosing loops. |
| `throw value` | Use the existing failure mechanism, without running following statements. |

The next-state update is simultaneous in meaning, like passing arguments.
Values captured from an iteration keep that iteration's immutable bindings.
Physical mutable slots, temporaries and capture snapshots are introduced by
common emission preparation, before target serialization.

Use one FAST vocabulary with documented stage invariants. Several small
passes may implement a stage, with a fixed, terminating order. The MVP needs
no general control-flow graph, global liveness optimization, or generic
continuation-passing framework.

| Stage | Owner and output contract |
| --- | --- |
| Binding and admission | Source bindings, writes, captures and transfer targets are resolved; source-only errors are checked before their evidence disappears. |
| AST-to-FAST and FAST normalization | Common FAST processing removes source sugar and makes branch results, loop inputs/results, next-state values and exit destinations explicit. Loops remain structured and may occur inside branches or other loops. |
| FAST to EDAG | `from_fast` preserves references/sharing and eager anchors, and introduces recursive loop helpers where necessary. It owns helper state and completion encoding. |
| EDAG to FAST and emission preparation | `to_fast` uses placement/evaluation analysis to recover bindings and eligible loops. Common FAST processing establishes invocation lifetimes, simultaneous updates and snapshots for all emitters. |
| Serialization | JS and Rust render the prepared FAST and map runtime operations; neither rediscovers graph sharing, extracts helpers or independently decides tail-call eligibility. |

The shared paths remain AST -> FAST -> EDAG and EDAG -> FAST -> target.
Preserve diagnostic origins across source normalization. Internal producers
maintain invariants; this proposal adds no repeated validation boundary.

#### Short-circuit operators become conditionals

Keep `&&`, `||` and `??` in source syntax, but remove their dedicated operations
from normalized FAST and canonical EDAG. Desugaring establishes the left operand
once as a fresh immutable value `t`, in the original evaluation region:

| Source | Core expression after establishing `t = a` |
| --- | --- |
| `a && b` | `t ? b : t` |
| `a \|\| b` | `t ? t : b` |
| `a ?? b` | `(t === null ? true : t === undefined) ? b : t` |

Here `undefined` denotes the primitive, not a name susceptible to shadowing.
The nullish test needs no new operation and does not use a logical operator
that would itself need desugaring. All references to `t` share the same value;
do not copy the expression `a`. Preserve operand identity, required failures,
and lazy evaluation of `b`. If the whole expression is conditional, its binding
stays inside that region. Source precedence and grammar restrictions stay intact.

This is semantic lowering, independent of optional EDAG optimization.
The [short-circuit operation TODO](../edag/todo/short-circuit-conditionals.md)
owns producer/consumer migration, removal of operation tags and the explicit
graph-identity compatibility decision. It can progress independently of loops.

#### Loop normalization

`while (condition) { BODY }` becomes a structured loop whose first action
tests the condition and exits when it is false. Its conceptual JavaScript
spelling is:

```js
while (true) {
    if (!condition) { break; }
    BODY
}
```

`BODY` denotes the original body with its original lexical scope, not a
literal text splice. Test the condition once per reached iteration, including
the first. A `continue` reaches the next test, and body-end fallthrough supplies
the current state to that same back edge.

Keep `break` as loop completion with explicit result values. Code after the
loop remains after it:

```text
state1 = loop L(state0) {
    ...
    if (condition) { break L(exitState) }
    ...
}
X(state1)
return F(Y(state1))
```

Moving `X; return Y` into each break site is a possible equivalence, but is not
the canonical lowering. It would introduce continuation scope, duplication
and cross-function calls that this design does not need. Resolved binding
and transfer identities preserve lexical scope; an exit-block declaration
cannot capture a name originally used after the loop.

A function may contain sequential loops, a loop inside either `if` arm,
or nested loops. FAST represents these directly in their execution regions.
Normalizing a loop does not create a source-level closure or move it to a
function's top level.

#### Loop helpers at the EDAG boundary

At `from_fast`, a loop that needs its own recursion becomes a local function.
Its initial call executes once each time control reaches the original loop
statement. Its iterations become its own tail self-calls. An inner loop has
a new initial call on each reached outer iteration, not one call for the
whole enclosing function.

For example, these two loops:

```js
let n = 0;
while (n < firstLimit) { n = n + 1; }
if (flag) {
    while (n < secondLimit) { n = n + 1; }
}
return n;
```

become conceptually, at the EDAG boundary:

```text
state1 = firstLoop([0], firstLimit)
state2 = if flag {
    secondLoop(state1, secondLimit)
} else {
    state1
}
return F(state2[0])
```

Here `firstLoop` and `secondLoop` stand for generated recursive functions;
the limits are immutable inputs and may be captured. FAST before this
boundary still contains the two structured loops.

For the general helper form, pass all outer mutable bindings referenced or
assigned by the loop in one internal state aggregate. Return the corresponding
outgoing state on normal completion. Use binding-introduction order, determined
during resolution, for stable fields; loop-local bindings stay local.
Immutable outer values may use ordinary captures. A minimal live-state analysis
is not an MVP prerequisite, and the aggregate avoids imposing the source
fixed-parameter limit on the number of loop variables. Internal state is never
exposed as a program result; source results retain their original identities.

Keep initialization, helper/capture construction and initial argument
evaluation in the original execution region. An unselected branch does not
enter its loop or evaluate its setup. Sequential loops receive preceding exit
state; nested helpers receive the current outer iteration's state.

A helper with only normal exits returns state directly. A helper that can
execute a `return` targeting the enclosing source function uses a distinct
internal completion, conceptually:

```text
["normal", state]
["return", value]
```

The caller resumes after the loop only for `normal`. For `return`, propagate
the completion through any enclosing generated helpers until the original
function returns the value. A return inside an ordinary nested source function
still belongs to that function. Resolve destinations before helper extraction;
a helper return must not accidentally swallow the enclosing function's return.
Throws and implicit failures continue through the existing failure channel,
not through a third invented completion tag.

An inner helper finishes by returning to its caller. It must not implement
the next outer iteration by calling the outer helper. That would create
cross-function recursion which self-tail-call elimination cannot remove.
The caller resumes, then performs its own next-state transition. Prove bounded
stack usage for repeated nested loops after lowering; lexical nesting may
contribute depth, iteration count must not.

Unlabeled loops and transfers are sufficient here. Labels, other loop syntaxes,
mutual-recursion elimination and general trampolining are separate extensions.

#### Tail-position analysis and output

Use one analysis integrated with the existing sharing, binding-placement and
evaluation-region work. A result flowing to a return is not sufficient:
the call's evaluation must be the final action on that path, with no pending
work consuming its result.

Starting at a function's returned expression, these forms identify candidates:

| Tail-position form | Candidate traversal |
| --- | --- |
| Direct call of this invocation's resolved `self` | Consider this call evaluation. |
| `A ? B : C` | Visit B and C, not A, in tail position. |
| Sequence/comma | Visit the last operand, retaining earlier required evaluations. |
| Another expression | No candidate established by these rules. |

Short-circuit operators have already become conditionals; canonical EDAG
analysis needs no additional cases for `&&`, `||` or `??`.

Do not cross into nested function bodies or identify self by printed names.
Tail position belongs to an evaluation/use, not globally to a shared node.
For example:

```js
const r = f(n - 1);
return r === 0 ? r : 1;
```

The condition already requires the recursive call. Reading `r` in its true
arm is not a new tail-call evaluation. Placement analysis must preserve that
value read, not chase it back to its initializer and emit a loop transition.
Likewise, calls in arguments, conditions or arithmetic remain ordinary calls
where work must consume their results. Earlier anchors may already establish
the same call, and lazy sharing must retain its conditional lifetime.

For each eligible direct self-call, `to_fast` produces a loop transition with
all argument values established before any invocation state changes. It does
not require every recursive reference to be tail: retain other calls and self
values, preserving function identity. Only the eliminated paths become
stack-safe. Ordinary user recursion is not made stack-safe merely because
its function also contains a source loop.

In output preparation, `return f(b, a)` is a simultaneous next-state transfer,
not `a = b; b = a`. Evaluate arguments and spreads under the current invocation,
preserving required failures even for unused extra arguments. Missing arguments
become `undefined`; rebuild rest arrays with fresh invocation identity.
Defaults and destructuring have already become invocation setup, which runs
on every iteration. Preserve the existing
[parameter/arity contract](../../spec/functions/parameters.md).

Loop parameters denote fresh immutable iteration values. When emission uses
mutable slots, introduce snapshots for captures before changing those slots.
For `f = (n, saved) => n === 0 ? saved : f(n - 1, () => n)`,
`f(2, null)()` must remain `1`. Recreate invocation-local memo cells and shared
identity-bearing values each iteration. Keep eager anchors eager and lazy
computations conditional.

#### Graph identity and round trips

Helper insertion is graph construction with structural consequences, not a
claim that equivalent programs have the same hash. Establish these rules
with the FAST contract:

- Reuse the enclosing function for a canonical root loop when the complete
  invocation/state, captures and exit contract match. In particular, the
  loop emitted for a direct tail self-call must read back without adding
  another wrapper. A `while` merely appearing first is insufficient:
  one-time setup cannot become per-iteration work.
- Otherwise introduce one helper at the loop's execution point. Preserve the
  existing single-variable lowering and exact-graph cases; its direct state
  parameter remains valid. The aggregate is the general helper form, not a
  reason to rewrite already-established graph identities.
- State/capture ordering is deterministic from resolved binding order or,
  for source-free EDAG, the shared analysis's stable operand traversal.
  Printed names, object addresses and incidental map iteration do not decide it.
- Preserve the existing exact-graph round-trip domain except for the explicitly
  migrated short-circuit tags in S below. Their removal changes graph structure
  and may change hashes; do not silently identify an old graph with its rewrite.
  Each new conversion case records its graph shape and any permitted normalization before promising
  exact equality. Test repeated conversion so wrappers or state packages do not
  accumulate. Semantics alone do not justify changing sharing or hashes.
- Output preparation may introduce physical slots/temporaries without changing
  the canonical input EDAG. Document observable function-text changes under
  the existing function-source exception.

#### Benefits and costs

The source remains familiar JavaScript while EDAG stays immutable and expression
based. Explicit state/results handle arbitrary loop placement, simultaneous
updates and captures in one model. Returning from inner helpers preserves
stack-safe loops without requiring general tail-call support. Each compiler
stage has one semantic responsibility.

The costs are whole-function write/capture classification, explicit branch and
loop results, and completion propagation for enclosing-function returns.
Capture refusal deliberately restricts JavaScript to prevent mutable cells
from escaping through frames; the post-loop/IIFE compatibility change needs
explicit migration. These costs belong to common compiler processing, not
duplicated JS/Rust serializers.

### Tasks and dependencies

Milestones are concrete work boundaries, not a requirement for one PR each.
Every implementation increment carries its proofs, documentation and affected
consumers. Reuse the linked architecture/migration tasks; unrelated tokenizer
moves and general constant evaluation do not block these steps.

| ID | Deliverable | Depends on |
| --- | --- | --- |
| A | FAST primitives, stage contracts and graph-identity rules | Relevant definition work in the [architecture TODO](./compiler-vocabulary-and-modularization.md), owned there |
| B | AST/FAST/EDAG input boundaries for currently accepted input | A |
| S | Normalize short-circuit expressions and remove their EDAG operations | Existing conditional/sharing contracts and a frontend lowering boundary; independent of generalized loops |
| C | Common EDAG-to-FAST placement and emission preparation, retaining existing loop behavior | A; B when verifying source round trips |
| D | General local rebinding and mutable-capture admission | B; recorded language-design approval |
| E | Structured loop state, branch results and resolved exits in normalized FAST | D |
| F | Loop helpers and normal/return completion handling at `from_fast` | E |
| G | Tail-evaluation eligibility integrated with existing placement analysis | Existing EDAG sharing/evaluation contracts; S for the canonical operation set, independent of FAST consumer migration |
| H | Eligible tail calls to stateful FAST loops and common invocation preparation | A, C's placement foundation, G |
| I | Finish consumer migration and integrate generalized loop slices | C, D, F, H, S for the complete feature |
| J | Publish final contracts and retire replaced paths/TODOs | I |

D can ship independently of E/F/H once its own input and output paths are
correct. G can be developed before C's consumers have migrated. H does not
depend on source-loop extraction or generalized `let`; begin with fixed-arity
self-calls and retain correct ordinary recursion for newly unsupported cases.
Add rest/default/capture cases in complete increments, preserving every
existing stack-safe case. Public source forms ship as soon as their own
complete conversion path is ready, not only when I is finished.
S may begin at the existing frontend lowering boundary; move/reuse that
implementation when B establishes AST-to-FAST desugaring, without parallel
normalizers. G can develop against conditional graphs before S finishes.

- [ ] **A — Define structured FAST.** Specify immutable bindings, branch results,
      loop parameters/results and resolved transfers. Define normalization and
      emission invariants, deterministic ordering, root-loop reuse and exact
      graph domains. Keep the shared model small and independent of target syntax.
- [ ] **B — Establish input boundaries.** Separate source binding/admission from
      sugar removal and expose `from_fast` for existing input. Preserve diagnostic
      origins, source sharing, eager anchors, captures and observable arity.
- [ ] **S — Remove redundant short-circuit operations.** Complete the
      [co-located TODO](../edag/todo/short-circuit-conditionals.md): establish
      the left operand once, retain lazy branches, migrate graph producers and
      consumers, and record schema/hash compatibility before removing the tags.
- [ ] **C — Establish shared output.** Extract placement and emission preparation
      once. Migrate consumers incrementally with the existing
      [tail-loop migration](../edag/todo/tail-call-loop.md#fast-migration);
      retain its current stack-safe and function-text contracts during the move.
- [ ] **D — Add rebinding.** Resolve declarations/writes by binding identity,
      classify mutable parameters over the whole function and check captures
      before optimization. Support ordinary declaration positions, existing
      binding patterns and an uninitialized `let`'s `undefined` after declaration;
      preserve TDZ/early errors. Lower reassignments to fresh values and branch
      results, retaining overwritten/unread required evaluations. Migrate the
      post-loop and immediate-call capture exceptions with explicit snapshots.
- [ ] **E — Normalize structured loops.** Lower conditions to negated exit tests,
      make state/results explicit and resolve break/continue/return destinations.
      Keep sequential, conditional and nested loops in their original FAST
      regions. Preserve condition/body scope and invocation-local lifetimes.
- [ ] **F — Lower helpers.** Introduce recursive functions only at `from_fast`
      where a loop needs one. Use explicit aggregate state for the general case,
      normal state results, and normal/return completion only where needed.
      Propagate enclosing-function returns and existing failures correctly.
      Prove that inner helpers return to callers and do not introduce recursive
      call cycles for source loop iteration.
- [ ] **G — Analyze evaluation in tail position.** Combine candidate traversal
      with shared-value placement; an already-evaluated result is a read.
      Cover either/both arms, sequences, lazy paths, nested scopes and mixed
      tail/non-tail uses without a second backend recognizer.
- [ ] **H — Emit stateful loops.** Use simultaneous next-state values, preserve
      self identity, and prepare snapshots/invocation setup in common FAST.
      Grow from fixed arguments to complete rest/default/spread behavior.
      Lift old restrictions only when their sharing/lifetime cases are correct.
- [ ] **I — Complete integration.** Move source, runtime JS, function text and
      Rust consumers to the shared path. Verify each newly admitted source
      slice end to end, update specification/examples, and record function-text
      changes. Finish the broad loop and invocation cases with their proofs.
- [ ] **J — Close the epic.** Move final contracts to README/JSDoc owners, retire
      replaced template-specific paths and reconcile related TODOs. Preserve
      surviving decisions and inbound links before deleting completed issues.

### Acceptance evidence

Add evidence with the step introducing the behavior:

| Concern | Required examples |
| --- | --- |
| Bindings | Standalone/module/nested `let`; several variables; branch results; initialization and TDZ; overwritten failing RHS; assignments around loops. |
| Captures | Capture before/after parameter assignment; nested writes; never-assigned `let`; explicit snapshots; post-loop and immediate-call migration. |
| Short-circuit normalization | Left operand evaluated once with identity retained; lazy right operand; falsy versus nullish values; nested lazy scopes; former tags absent from canonical graphs; explicit old-graph compatibility. |
| Loop tests | Initially false skips body; changing condition and continue re-test once; failing condition; original body scope retained. |
| Loop results | Multiple breaks with different state; following code runs once after normal exit and not after return/failure; exit-block shadowing cannot change following names. |
| Placement | Sequential state transfer; either `if` arm; unselected helper setup stays unevaluated; multiple outgoing values; more state fields than the source fixed-parameter limit. |
| Nested completion | Inner break/continue stay inner; return crosses all generated helpers to its owning function; source nested-function returns stay local; returned payloads shaped like completion tags remain ordinary values. |
| Tail evaluation | Bare/either-arm self-call; sequence anchors; the shared `r` condition example; previously established calls; lazy sharing; non-tail argument/arithmetic calls; mixed uses and nested scopes. |
| Invocation | Swapped/dependent arguments; missing/extra and unused failing arguments; spreads; fresh rest identity; defaults/destructuring every iteration; unchanged function length. |
| Lifetimes | Saved-closure example; per-iteration objects/functions and memo cells; sharing across condition/body; eager failures and unselected lazy failures. |
| Stack safety | Existing million-round cases plus generalized tail-only cases in JS/Rust; a million outer iterations containing inner loops, without helper call cycles. |
| Identity | Unaffected existing exact-graph cases; documented short-circuit schema/hash migration; declared new round-trip domains; stable state order; repeated conversions do not accumulate wrappers; setup stays once and sharing remains explicit. |
| Consumers | Interpreted and generated results/failures agree under the existing failure contract; the same prepared FAST drives JS and Rust. |

### Design record and language approval

The architecture revision was requested by `sergey-shandar` in the
[originating session](https://chatgpt.com/c/6ad8c457-d2cc-83e8-a37f-ab7f4e603e0e),
with simplicity and separation of concerns as the main principles. It replaces
mandatory continuation substitution and pre-EDAG helper extraction with
structured FAST and state-returning helpers at the EDAG boundary.

This PR records the design; it implements no language changes. Record formal
language-design approval and its link before implementing the new source
semantics under
[DESIGN.md section 12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
The original single-variable approval remains limited to its existing scope;
architecture acceptance does not mark implementation milestones complete.

### Related

- [Compiler vocabulary and modularization](./compiler-vocabulary-and-modularization.md)
  — representation/stage ownership and common conversion prerequisites.
- [Let statement](../../spec/todo/3220-let.md) — existing subset and later source work.
- [Tail-call loops](../edag/todo/tail-call-loop.md) — existing stack-safe outputs and migration.
- [Short-circuit conditionals](../edag/todo/short-circuit-conditionals.md)
  — simplify canonical EDAG to conditional expressions while preserving source syntax.
- [Loops](../../spec/control-flow/loops.md),
  [captures](../../spec/functions/captures.md) and
  [parameters](../../spec/functions/parameters.md) — current source contracts.
- [EDAG](../edag/README.md) — graph identity and evaluation semantics.
- [Function text](../edag/function-text.md) — observable output contract.
- [Mutable objects](../../spec/design/mutability.md) — separate later work.
