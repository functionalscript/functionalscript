## Construct EDAG from structured FAST loops

**Priority:** P2
**Status:** wip — scalar construction, fixed-input roots and normal-exit
aggregate helpers are implemented; nested helpers, completions and shared
lazy demand-state transport remain in E
**Blocked by:** [FAST contract, milestone A](../../todo/general-loops-and-tail-calls.md#implementation-order)

### Problem

General loops need a single graph-construction owner. Source-mutability
analysis, target loop spelling and EDAG helper construction are separate
concerns. This task owns scalar construction needed by foundation milestone B
and its generalization in E, in `fjs/edag/from_fast`.

### Input contract

Consume [normalized FAST](../../todo/compiler-vocabulary-and-modularization.md#fast-contract):
loop parameters and initial values, result signatures, immutable references,
and resolved break/continue/return targets. Branch results and required
evaluations are already explicit.

AST-to-FAST chooses which source bindings travel through a loop. This
conversion neither searches for outer mutable names nor performs liveness
analysis. Immutable free values use ordinary captures. Internal producers
maintain the contract; no repeated validation pass is added.

A loop may appear sequentially, in either branch, or inside another loop.
Keep its initial call and frame/argument construction at that execution point.
An unselected branch evaluates none of its loop setup; an inner loop gets a
new entry on every reached outer iteration.

### Helper construction

Unless the root-loop rule below applies, construct a local recursive function:

- Its state parameter carries the loop's declared parameter values. Preserve
  the established scalar single-variable graph where it already applies;
  use one ordered aggregate for the general signature.
- Each continue evaluates all next-state values under the current iteration,
  then tail-calls this helper with the new state. Body fallthrough has already
  become an explicit continue.
- Each normal break returns the loop's declared result values. These need not
  be the entire input state: the input and result signatures are distinct.
  The general helper returns one aggregate in result-signature order, including
  zero or one result; only the established scalar case retains its scalar result.
- The caller binds those results and resumes after the loop. It does not copy
  following statements into exit sites.

The signature order comes from FAST. Source construction uses resolved binding
introduction order; source-free graph conversion uses its documented stable
operand order. Printed names and map iteration do not determine state layout.
The general aggregate avoids the source fixed-parameter limit; internal state
packages never become a user result accidentally.

For example, the structured FAST:

```text
r = loop L(n = initial) -> (value) {
    if (done(n)) { break L(n) }
    continue L(next(n))
}
use(r)
```

constructs a recursive helper whose normal result is the value bound as `r`.
A second loop consumes the first loop's results at its own entry point.
No source-level closure is introduced before source capture checks.

### Shared lazy demand state

A free reference is not permission to establish a lazy initializer while
constructing the helper. For example, a lazy value read only in a skipped
loop arm remains unevaluated, and one first demanded inside the loop is reused
by later iterations and following statements in its owning invocation.

Thread an ordered internal memo vector alongside the helper's user state.
Each cell carries an initialized flag and its established value; the flag
distinguishes an undemanded initializer from any source payload. A demand
selects the stored value or evaluates the initializer with the current memo
state, then supplies the value and updated memo state together. Failed
initialization uses the existing failure channel and never supplies a ready
cell. Conditional regions update only the selected arm's state.

Internal continues carry next user state and memo state simultaneously.
Normal and escaping helper completions carry the updated memo vector back to
the caller, which retains it for subsequent demands and sequential loops.
Nested helpers receive the same owning cells and return their updates to
their caller; no generated helper directly invokes an enclosing helper.
The declared normalized loop input and result signatures remain unchanged.

Initializer recipes depend on established immutable values or other memo
cells. Discover those dependencies through their resolved identities without
performing source write analysis. Capture established prerequisites normally;
thread undemanded dependencies as cells instead of evaluating them to build
the frame. A lazy definition introduced inside an iteration starts fresh on
each new iteration, while an enclosing invocation's cell survives it. Nested
loops share an outer iteration's cell only for that iteration's lifetime.

The general internal state/result packages include this bookkeeping. The
existing scalar graph remains unchanged where no such demand state crosses
the helper boundary. Pin the memo-bearing graph normalization and stable
cell ordering with its first implementation.

### Enclosing-function returns

A loop helper with only normal exits returns its results directly. If the
loop can return from the enclosing source function or transfer to a lexically
enclosing loop, use the internal completion forms:

```text
["normal", resultValues]
["return", value]
["break", targetId, resultValues]
["continue", targetId, nextValues]
```

These forms are private to this conversion. `targetId` is a deterministic
encoding of the resolved loop identity within the owning function, not a
printed name or the identity's presentation index. FAST, admission and
serializers know only their own loop/result/return constructs.

A caller resumes after the loop for normal completion. A source-function
return propagates through enclosing generated helpers until its owning
function returns the payload. A break or continue targeting an enclosing loop
propagates until that loop's caller processes its own result or transition;
intermediate helpers do not perform the outer transition. An ordinary nested
source function owns its own returns. Source values resembling completion
tags remain payloads, not control signals. Existing throws/failures propagate
through the existing failure channel; there is no additional failure tag.

An inner helper returns to its caller. It never calls an outer helper to
continue an outer iteration: that would create a recursive call cycle which
self-tail-call elimination cannot make stack-safe. The caller processes the
inner result and performs its own transition.

### Canonical root loops

The fixed-input increment implements direct reconstruction for zero through
sixteen fixed parameters, no rest binding and one opaque public result, while
keeping the established scalar shape first. Its contract lives in
[`from_fast/loop/root`](../from_fast/loop/root/README.md). This is part of E;
normal-exit general helpers are also implemented. Nested helpers/transfers,
operand control and rest transitions remain open below.

The current fixed-input root constructor shares the suffix of wholly normal
result regions. A region with nonlocal exits can still reconstruct the suffix
independently for more than one normal exit. For example, both arms below can
return or yield, so repeating this statement grows the following suffix
exponentially:

```text
if (condition) {
    if (stopA) { return F(a) }
    yield ()
} else {
    if (stopB) { return F(b) }
    yield ()
}
followingStatements
```

A bounded reproduction grew the normalized function from 4,949 bytes for four
such statements to 79,349 for eight and 1,269,749 for twelve. This performance
case remains open: implement a shared normal/control join in the graph owner,
preserving the existing partially abrupt result-region behavior. Reusing a
task or AST object alone still reconstructs the suffix in each branch. A
continuation function would add an invocation and can create recursive call
cycles; wrapping returned self calls in eager completion payloads would remove
their direct tail position. Keep terminal public results and self calls direct.

Normalized loop bodies already have explicit transfers and no implicit
fallthrough. A reached loop-body `yield` violates that precondition and is
refused, rather than being interpreted as a return or a new iteration.

Implement the scalar form needed by common existing output during B, before
output migration C. E extends it to general invocation/result signatures.
The FAST contract in A names the exact-graph domain. If canonical root reuse
conflicts with an existing source-to-graph expectation, record the specific
normalization and update its contract/fixtures in A/B before C; do not assume
that removing a wrapper preserves its identity or defer the conflict to a writer.

Reuse the enclosing function for the canonical root-loop form only when all
of these structural conditions hold:

1. Its body is the loop and a direct return of that loop's single result,
   allowing only aliases of invocation inputs outside the loop. No required
   computation, allocation or invocation setup stands before it.
2. Loop entry values are exactly that function's current invocation inputs.
   The fixed-argument/rest layout and each next-invocation transition agree.
   Default/destructuring setup that repeats per call stays inside the loop.
3. Captures and retained self references refer to the same enclosing function;
   reuse does not change its frame, identity or observable arity.
4. A normal loop exit supplies the function's result directly. A source return
   targets that same function. No following computation or completion/state
   decoder must run after the loop.

A loop merely appearing first does not satisfy this rule. Otherwise use a
helper. If a future case needs more reuse, extend this rule with its positive
and negative graph fixtures rather than introducing a second heuristic.

`to_fast`'s eligible direct-self-loop form follows this contract so reading
its normalized FAST back does not add a wrapper. Physical prepared FAST is
not the input to `from_fast`.

### Pending member-resolution decision

Lifting argument control must preserve the lookup boundary. In
`null.f(argument-block-returning-7)`, lookup fails before that successful
return; calling an already evaluated noncallable value instead reaches the
arguments before callable validation. A nullish optional receiver skips its
key and arguments. A plain property read cannot express the optional-call
guard for native methods: it may yield undefined where a member call exists.

The proposed minimal extension is `['memberPresent', receiver, key]`, returning
the existing member-call guard's Boolean result or ordinary lookup failure.
It must reuse the operation kernel's own/native/runtime resolution, including
key coercion and null-receiver failure. An own null/undefined field is absent;
an own noncallable nonnull value is present and fails only when invoked after
its arguments. Native and runtime members use the existing guard, with no
second method inventory. Normal optional-chain regions decide whether the
query itself is reached. Bare optional calls need only their callee's nullish
test. The proposed tag remains absent from the current canonical schema.

This query would precede the existing member call after selected argument
control. With pure lookup, repeating resolution preserves language outcomes;
the straightforward query plus ordinary call performs three runtime `dot`
lookups where the existing optional call performs two. That cost is explicit.
The alternative is a first-class resolved-member value and invocation form,
which avoid that repeated lookup but require a larger value/schema/runtime
contract. The owner decision is pending; neither alternative is provisionally
admitted. Full E must settle this boundary and common preparation's matching
receiver/callee handling before its normalized contract is complete.

Expand an earlier array/call spread before a later value operand can return or
transfer. Snapshotting only the spread operand does not preserve a failing
expansion before a successful transfer. This boundary belongs to common
preparation and construction, alongside member resolution; target writers do
not independently infer it.

### Identity and evidence

Preserve established exact-graph loop cases outside any normalization explicitly
recorded in A/B. For each general signature and
completion form, record its graph shape with the first implementation.
Promise exact EDAG -> FAST -> EDAG equality only for the named canonical
domain, accounting for the separate short-circuit schema migration.
Other supported conversions preserve semantics and explicit sharing under
their documented normalization. Repeated conversions must stabilize.

- [x] **B:** Preserve the existing scalar construction and implement scalar
      root-loop reconstruction required by C. Pin its exact-graph domain and
      any explicit normalization before migrating output.
- [x] **E, after D:** Construct normal-exit general helpers using explicit loop signatures.
      Cover different input and output arities and state beyond the source
      fixed-parameter limit. State and result arrays follow the declared order;
      the scalar shape remains first. The common root resolver constructs the
      packed invocation loop, and the caller shares one call across projections.
      First-pass conversion may split non-minting state-slot property reads
      across conditional arms; repeated conversions stabilize.
- [x] Preserve sequential and conditional execution regions, including
      unevaluated setup in an unselected branch.
- [ ] Extend helper construction to nested execution regions.
- [ ] Implement normal results and enclosing-function completion propagation.
      Cover several breaks, nested returns, source nested-function returns,
      completion-shaped user values and failures.
- [ ] Propagate resolved breaks and continues through inner helpers to their
      enclosing target without recursive helper cycles. Distinct target
      identities with the same presentation index remain distinct.
- [ ] Thread shared lazy demand state through helpers, conditional demands,
      continues and completions. Cover skipped failures, identity reused across
      iterations and following code, sequential/nested loops, and fresh
      iteration-local cells without changing public loop signatures.
- [ ] Implement the root-loop rule with exact fixtures, including rejection of
      one-time setup, changed invocation layouts and following result processing.
- [ ] Keep the existing scalar shape; pin deterministic general state/capture
      ordering and stable repeated conversions.
- [ ] **F integration:** With shared emission, run repeated nested loops without
      recursive helper cycles or stack growth proportional to iterations.

### Related

- [Epic](../../todo/general-loops-and-tail-calls.md) — order and integration gates.
- [Compiler architecture](../../todo/compiler-vocabulary-and-modularization.md)
  — FAST and conversion boundaries.
- [Source bindings and loops](../../../spec/todo/3220-let.md#later)
  — selection of explicit loop state and source admission.
- [Tail-call loops](./tail-call-loop.md#general-tail-calls)
  — recognizes helper tail evaluations and prepares shared output.
- [EDAG](../README.md) and [function text](../function-text.md)
  — current sharing, identity and output contracts.
