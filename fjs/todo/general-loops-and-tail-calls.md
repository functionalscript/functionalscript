## General loops and tail calls

**Priority:** P2
**Status:** open — epic and language proposal; implementation has not started
**Blocked by:** the FAST foundation and common conversions in
[compiler vocabulary and modularization](./compiler-vocabulary-and-modularization.md),
as split into prerequisites below

### Problem

The compiler admits `let` only beside a particular single-variable `while`,
and output recognizes essentially `r => condition ? self(next) : r`.
Ordinary local rebinding, multiple loop variables and structured exits do not
need separate graph operations or a growing catalogue of source templates.
They need explicit binding and control-flow semantics, with loops and tail
self-calls converted through one shared foundation representation.

This epic connects the existing FAST architecture, the admitted
[`let`/`while` form](../../spec/control-flow/loops.md), and the
[tail-loop migration](../edag/todo/tail-call-loop.md#fast-migration).
Those TODOs retain their implementation tasks. This file owns their dependency
order and the broader language and normalization design; it does not claim
that FAST or the broader grammar already exists.

### Proposal

#### Mutable bindings, immutable captures

Allow `let` independently of a loop in every declaration position supported
by the source grammar, including modules, function bodies and nested blocks.
Keep JavaScript's lexical scope and initialization rules. Local assignment
changes the value associated with a binding, not an existing EDAG value.
This stage concerns binding reassignment, not mutation of object contents;
the latter remains the separate [mutability design](../../spec/design/mutability.md).

- Every `let` binding is mutable, whether or not it is actually assigned.
- A parameter assigned in its declaring function is mutable throughout that
  function. Classify it before checking captures, including captures that
  appear before the assignment. An assignment alone is valid; combining it
  with a capture is the error.
- A mutable binding cannot initialize a nested function's frame. Both a read
  and a write from a nested function count as a capture; a nested assignment
  must not become a way to mutate an enclosing binding.
- `const snapshot = value` binds the current value and may be captured.
  It does not clone an object. A mutable binding does not silently become
  immutable at the end of a loop or after its last assignment.

```js
let x = 5;
x = 6;
const bad = () => x; // rejected: mutable binding captured
```

```js
let x = 5;
x = 6;
const snapshot = x;
const good = () => snapshot;
```

```js
const g = a => {
    const a0 = a;
    const f = () => a0;
    a = 5;
    return f;
};
```

The new rule replaces the current special treatment of the variable as a
`const` after its loop. Record that compatibility change, and update affected
source and proofs with explicit snapshots. Apply capture admission before an
optimization could erase the function boundary; do not make acceptance depend
on whether a compiler happens to inline an immediately called function.

#### FAST is a foundation IR

FAST means Foundation AST in the architecture vocabulary, but its data model
need not be a subset of the JavaScript AST or even a syntax-shaped tree.
It may use a primitive `loop` rather than a JavaScript `while` node, explicit
binding identities rather than names, and explicit control transfers.
Only source AST models source spelling. An internal `loop` does not add a
`loop` keyword to FunctionalScript.

Define a small set of foundation constructs and documented normalization
stages, used in both directions. Several passes may normalize FAST: one
desugars source loops, another resolves their exits, another makes state and
captures explicit. Each pass states its input and output invariants and a
terminating order; do not require a single giant pass or an unspecified
repeat-until-stable rewrite engine. The exact representation belongs to the
FAST prerequisite, not to separate backend implementations.

The shared boundaries remain AST -> FAST -> EDAG and EDAG -> FAST -> target.
Common FAST processing owns semantic normalization, binding placement and
evaluation regions. JS and Rust serializers spell those decisions. Preserve
source origins for diagnostics before source-only constructs disappear.

#### Loop and exit normalization

`while (condition) { BODY }` has this conceptual JavaScript normalization:

```js
while (true) {
    if (!condition) { break; }
    BODY
}
```

The guard is **`!condition`**, tested before every iteration, including the
first; a `continue` reaches the next test. In FAST this can be `loop` with
a conditional exit. Keep evaluation of the condition once per test and keep
the original body scope; this is not a literal AST splice that can change
name resolution.

For a loop followed by `X; return Y`, the post-loop continuation can absorb
each `break` targeting that loop:

```js
while (true) {
    BEFORE
    if (condition) {
        AT_EXIT
        break;
    }
    REST
}
X
return Y;
```

is conceptually

```js
while (true) {
    BEFORE
    if (condition) {
        AT_EXIT
        X
        return Y;
    }
    REST
}
```

`BEFORE`, `AT_EXIT`, `REST`, `BODY`, and `X` stand for statement sequences;
these are normalization sketches, not compilable source examples. `REST`
remains on every non-exit path. The actual rewrite preserves resolved binding
identities and the continuation's original lexical scope: a name declared in
`AT_EXIT` must not capture a read originally in `X` or `Y`.

The continuation receives the mutable values at the exit, after `AT_EXIT`.
It executes exactly once on the selected exit and never on `continue`, direct
function `return`, or failure. Multiple breaks may reference one continuation
rather than duplicate its code. This is a compiler continuation, not a source
closure capturing mutable bindings; pass its state explicitly when represented
as a helper function. Preserve invocation lifetimes and sharing across this
boundary rather than introducing a new observable function identity.

Resolve the target of every `break` and `continue` before moving code. A break
in an inner loop reaches that loop's continuation, not the function's final
return. Normalize nested loops from their resolved scopes, carrying outer
mutable values that the inner loop changes. A function `return` or `throw`
exits through all enclosing loops without running their post-loop code.
Start with ordinary unlabeled loops and transfers; labels and other loop
syntaxes are separate extensions, not prerequisites of this epic.

For canonical loop-to-EDAG construction, the back edge is a tail call of a
generated loop function over all values carried between iterations. A
`continue` supplies the values at that point; reaching the body end supplies
the final values. A loop exit proceeds to the correct continuation with the
exit values. Keep setup outside the loop once, and computations inside it once
per reached iteration. No cyclic EDAG or new EDAG loop node is needed: recursion
continues to use the existing scoped `self` representation.

#### Tail-position analysis and output

Analyze each function separately. Starting at its returned expression:

| Tail-position form | Action |
| --- | --- |
| Direct call of this invocation's `self` | Mark this call occurrence as a tail self-call. |
| `A ? B : C` | Visit `B` and `C`; do not visit `A` in tail position. |
| Sequence/comma | Visit its last operand; retain earlier required evaluations. |
| `A && B`, `A || B`, `A ?? B`, if still present | Visit the selected right operand in tail position, or normalize to a conditional while evaluating `A` once. |
| Another expression | No tail self-call established by these rules. |

Use resolved self identity and the owning scope, not a printed function name.
Do not cross into nested function bodies. Tail position belongs to a use:
a shared node also used in a non-tail context cannot be globally replaced.
Preserve its sharing and evaluation region when deciding whether a particular
occurrence can be lowered. Calls inside arguments or conditions, and calls
whose result is consumed by another operation, remain ordinary calls.

Finding any eligible call is sufficient to introduce a loop in that function;
every recursive reference need not be tail. Preserve the function and its
identity wherever other self references remain. Only the replaced recursive
paths acquire constant stack usage. Mutual recursion and general trampolining
are outside this epic.

`to_fast` surrounds the invocation body with a foundation loop. In tail
position, a conditional becomes control flow whose arms return, fail or
continue. A conditional inside a larger expression does not acquire returns.
Replace a tail call only after establishing all of its arguments using the
current invocation's values:

```js
// return f(e0, e1, e2);
const nextA = e0;
const nextB = e1;
const nextC = e2;
a = nextA;
b = nextB;
c = nextC;
continue;
```

This is a parallel state update expressed through temporaries. Sequential
`a = b; b = a` does not implement `return f(b, a)`. Preserve argument
evaluation and required failures, including unused extra arguments. Missing
arguments become `undefined`; spreads and rest are evaluated anew for each
invocation. Defaults and destructuring have already been normalized into
invocation setup, which must run on every iteration. Preserve observable arity
and fresh rest-array identity under the existing
[parameter contract](../../spec/functions/parameters.md).

A recursive invocation's immutable parameters may be captured. After lowering,
captures must read fresh immutable per-iteration snapshots, not mutable loop
slots. For example, `f = (n, saved) => n === 0 ? saved : f(n - 1, () => n)`
must still make `f(2, null)()` answer `1`. Recreate invocation-local memo cells
and shared values each iteration. Keep eager anchors eager and lazy
computations conditional; never hoist a failing initializer out of its branch
or an iteration-local computation outside the loop.

#### Compatibility, benefits and costs

The source spelling is familiar JavaScript, while EDAG remains expression
based and immutable. Multiple state values and structured exits use the same
conversions as simple loops. All MVP targets share the correctness work and
the same tail-call decision.

The costs are whole-function assignment/capture classification, explicit
continuations and per-iteration scope handling, and proofs for the additional
normalization passes. Capture refusal intentionally restricts JavaScript;
its benefit is that no mutable cell can escape through a function frame.
The stricter rule affects current post-loop captures and immediately called
captures, so migration must name and test those changes rather than silently
change accepted programs. The generated function-text spelling may also
change; document it under the existing function-source exception.

### Tasks and dependencies

Each step includes its proofs, documentation and affected consumers. A check
is not a separate implementation PR. The IDs below denote milestones, not
new modules or a requirement for one PR per row. Reuse work from the linked
TODOs rather than implementing a second version here.

| ID | Deliverable | Depends on |
| --- | --- | --- |
| A | FAST constructs, binding identities, control targets and staged normalization contracts | Relevant foundation tasks in [compiler architecture](./compiler-vocabulary-and-modularization.md) |
| B | AST-to-FAST and FAST-to-EDAG boundaries for currently accepted input | A |
| C | Common EDAG-to-FAST placement and all existing output consumers, preserving current loop support | A, B; [tail-loop FAST migration](../edag/todo/tail-call-loop.md#fast-migration) |
| D | General binding/capture admission and local rebinding | A, B; recorded language-design approval |
| E | Conditional-loop, break, continue and post-loop-continuation normalization | A, B, D; recorded language-design approval |
| F | General normalized FAST loops to EDAG, including nested loops and exits | E |
| G | General tail-position self-call analysis | C |
| H | Tail self-calls to FAST loops with full invocation state and capture snapshots | C, D, F, G |
| I | Complete public source admission and backend integration for the broadened forms | D, F, H |
| J | Finish migration, publish final contracts and retire replaced paths/TODOs | I |

The binding/loop path D -> E -> F and the output-analysis path C -> G can
advance independently after their listed foundations. H joins them. Only the
relevant FAST foundation is a prerequisite: unrelated tokenizer moves,
general constant evaluation, and the full architecture cleanup do not block
this epic. Until I, preserve current admitted programs and reject unsupported
new forms explicitly; do not expose syntax whose complete conversion path is
not ready. The intentional capture-rule change lands with its migration.

- [ ] **A — Establish FAST.** Extend the existing architecture task with a
      foundation IR capable of core loops and resolved transfers, ordinary
      functions, immutable bindings and mutable state. Define where each
      normalization pass runs and what invariant its consumer may assume.
      Keep representation in one owner; no per-backend FAST dialects for
      semantic decisions.
- [ ] **B — Establish input boundaries.** Separate binding/admission from
      desugaring where needed, preserve source origins and early errors, and
      expose `from_fast` for the existing admitted language. Preserve current
      graph sharing, eager anchors, captures, arity and applicable round trips.
- [ ] **C — Migrate current output.** Extract shared placement to `to_fast` and
      move source output, runtime JS, function text and Rust onto common FAST
      processing. Reuse the existing recognizer before broadening it. Carry
      the current stack-safe cases and capture/region proofs; retire their
      parallel writer decisions only when equivalent common behavior exists.
- [ ] **D — Add general rebinding.** Resolve declarations and writes by binding
      identity, classify mutable parameters over the whole function, and
      reject mutable captures independently of statement order or inlining.
      Support `let` in ordinary supported declaration positions, including
      an uninitialized binding's JavaScript `undefined` value after declaration.
      Preserve supported binding patterns and initialization/TDZ checks.
      Lower assignments through an environment of current expressions and
      merge branch state without inventing mutable EDAG nodes. Preserve the
      evaluation of overwritten or unread right-hand sides. Include snapshots
      and the migration from the old post-loop/IIFE capture exceptions.
- [ ] **E — Normalize control flow.** Resolve transfer targets, lower
      `while (condition)` to a core loop with the negated exit guard, and lower
      breaks through correctly scoped post-loop continuations. Handle several
      exits, continues, body-end back edges, nested loops, direct returns and
      failures. Define how later passes make loop state and continuation
      arguments explicit without uncontrolled code duplication.
- [ ] **F — Construct recursive EDAG.** Compile normalized loop regions and
      their continuations to functions/tail calls over the necessary state.
      Keep pre-loop setup outside, rebuild iteration-local values, and preserve
      outer mutable state changed by nested loops. Prove this boundary without
      depending on an optimizer to repair evaluation or sharing.
- [ ] **G — Analyze tail calls.** Replace the single-template question with
      per-function analysis of tail occurrences through conditionals and
      sequences, normalizing other supported short-circuit forms as needed.
      Cover either arm, multiple call sites, mixed tail/non-tail recursion,
      nested function scopes and shared nodes. Retain ordinary calls where
      eligibility is not established.
- [ ] **H — Build FAST loops.** Emit one canonical loop decision in `to_fast`,
      evaluate arguments before state updates, and recreate the complete
      invocation state. Add capture snapshots and correct placement of
      invocation setup, rest/default handling, eager anchors and lazy memo
      values. Lift old recognizer refusals only as these cases become correct;
      do not leave restrictions solely because the old source template could
      not express them. Retain self identity and ordinary recursion where used.
- [ ] **I — Integrate the broadened forms.** Enable the source grammar and
      admission contract with every affected consumer updated. JS may spell
      the core loop as `while (true)` and Rust as `loop`; both consume the same
      normalized control flow. Verify the new source/EDAG/output round trips,
      update the loop/parameter/capture specification and compiler examples,
      and document any function-text change before updating expectations.
- [ ] **J — Close the epic.** Move final invariants and pass contracts into
      their README/JSDoc owners, reconcile the existing let and tail-loop TODOs,
      remove obsolete template-only paths, and delete completed TODOs only
      after their surviving contracts and inbound references are preserved.

### Acceptance evidence

Add evidence with the step that introduces the behavior:

| Concern | Required examples |
| --- | --- |
| Bindings | Standalone and nested/module `let`; multiple state variables; assignments before and after loops; branch merges; uninitialized reads after declaration; invalid TDZ reads and immutable assignments. |
| Capture admission | Captures before/after a parameter assignment; a nested write; a never-assigned `let`; explicit snapshots; post-loop and immediately called capture migration. |
| Loop condition | Initially false condition skips the body; a changing condition is tested on every iteration; `continue` re-tests it; a failing condition remains required. |
| Break continuation | Multiple breaks with different exit state; `X; return Y` executes once; non-exit `REST` survives; exit-block names cannot capture continuation names; direct return/failure skips the continuation. |
| Nested control | Inner break/continue target the inner loop; outer state changes survive the inner exit; direct function return leaves both loops. |
| Tail analysis | Bare self-call; either/both conditional arms; nested conditionals; preceding comma anchors; non-tail calls in conditions/arguments/arithmetic; mixed recursion; shared-node and nested-function boundaries. |
| Invocation state | Swapped and dependent arguments; missing and extra arguments; unused failing arguments; spreads, fresh rest arrays, defaults and destructuring each invocation; preserved function length. |
| Lifetimes | The saved closure example; per-iteration identity-bearing objects/functions; values shared between condition and body; eager failing initializers and unselected lazy failures; memo cells reset per invocation. |
| Integration | Existing million-round cases stay stack-safe; generalized tail-only cases run a million iterations in JS and Rust; interpreted and generated results/failures agree under the existing failure contract. |
| Round trips | Source -> FAST -> EDAG -> FAST -> source -> EDAG preserves semantics and specified sharing; retain existing exact-graph cases and explicitly name the domain/normalizations for any new exact-graph guarantee. |

### Language-design approval

The language direction and loop/FAST refinements were proposed by
`sergey-shandar` in the originating conversation. This PR records the epic;
it does not implement the language changes. Record the formal approval and
its link before D/E implementation under
[DESIGN.md section 12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).
The original single-variable approval remains limited to its existing scope.
Do not treat this epic's unchecked milestones as completed approvals.

### Related

- [Compiler vocabulary and modularization](./compiler-vocabulary-and-modularization.md)
  — FAST and the common conversion boundaries; reused prerequisites A-C.
- [Let statement](../../spec/todo/3220-let.md) — original admitted subset;
  this epic coordinates its broader rebinding and control-flow work.
- [Tail-call loops](../edag/todo/tail-call-loop.md) — current recognizer and
  stack-safe outputs; common migration precedes broadening.
- [Loops](../../spec/control-flow/loops.md),
  [captures](../../spec/functions/captures.md) and
  [parameters](../../spec/functions/parameters.md) — current source contracts.
- [Function text](../edag/function-text.md) — observable output contract.
- [Mutable objects](../../spec/design/mutability.md) — distinct later work.
