## Construct EDAG from structured FAST loops

**Priority:** P2
**Status:** open — baseline scalar construction in B; general construction in E
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

### Enclosing-function returns

A loop helper with only normal exits returns its results directly. If the
loop can return from the enclosing source function, use the internal completion
forms:

```text
["normal", resultValues]
["return", value]
```

These forms are private to this conversion. FAST, admission and serializers
know only their own loop/result/return constructs.

A caller resumes after the loop for normal completion. A source-function
return propagates through enclosing generated helpers until its owning
function returns the payload. An ordinary nested source function owns its own
returns. Source values resembling completion tags remain payloads, not control
signals. Existing throws/failures propagate through the existing failure
channel; there is no additional failure tag.

An inner helper returns to its caller. It never calls an outer helper to
continue an outer iteration: that would create a recursive call cycle which
self-tail-call elimination cannot make stack-safe. The caller processes the
inner result and performs its own transition.

### Canonical root loops

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

### Identity and evidence

Preserve established exact-graph loop cases outside any normalization explicitly
recorded in A/B. For each general signature and
completion form, record its graph shape with the first implementation.
Promise exact EDAG -> FAST -> EDAG equality only for the named canonical
domain, accounting for the separate short-circuit schema migration.
Other supported conversions preserve semantics and explicit sharing under
their documented normalization. Repeated conversions must stabilize.

- [ ] **B:** Preserve the existing scalar construction and implement scalar
      root-loop reconstruction required by C. Pin its exact-graph domain and
      any explicit normalization before migrating output.
- [ ] **E, after D:** Construct general helpers using explicit loop signatures.
      Cover different input and output arities and state beyond the source
      fixed-parameter limit.
- [ ] Preserve sequential, conditional and nested execution regions, including
      unevaluated setup in an unselected branch.
- [ ] Implement normal results and enclosing-function completion propagation.
      Cover several breaks, nested returns, source nested-function returns,
      completion-shaped user values and failures.
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
