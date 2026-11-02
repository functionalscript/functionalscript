# Control-flow model and conversion audit

This audit applies the [control-flow vocabulary](../todo/compiler-vocabulary-and-modularization.md#control-flow-vocabulary)
across source syntax/admission, FAST, EDAG and target reconstruction.
Representability does not imply source admission. Drafts
[#3511](https://github.com/functionalscript/functionalscript/pull/3511) and
[#3512](https://github.com/functionalscript/functionalscript/pull/3512) remain
paused; their experiments do not change current admission.

The [reference cases](../../doc/sergey/control-flow.md) are fragments. Admission
checks add ordinary-function wrappers with explicit final returns. Cases 8/9
already contain the corrected break result and initial invocation. Case 10
adds a conditional loop. Implicit returns and source case fall-through remain
outside admission.

## Approved control-flow contract

The task owner approved this contract and the ordinary-function conditional
increments; the
[proposal and approval](../todo/compiler-vocabulary-and-modularization.md#first-approved-admission-boundary)
and [partly returning boundary](../todo/compiler-vocabulary-and-modularization.md#partly-returning-admission-boundary)
record their scope.

- Explicit source returns remain required. Ordinary-source cases 4, 6
  and 7 admit at most one written outer binding; supplied FAST and source
  readback have separate gates.
- Normal region completion supplies ordered results. Return, break and continue
  retain their resolved owner and bypass the normal join. Failure uses its
  existing channel; nested ordinary functions own their returns.
- The implemented non-loop join profile uses immutable versions and
  parameterized continuations, preserving selected work, shared allocations
  and invocation lifetimes.
  Broader mutable storage remains an optional optimization.
- Loop input and result signatures are independent. Continuing establishes all
  next inputs from one old snapshot; breaking supplies the loop's results.
- Eligible graph-route self-tail evaluations use `while`, including transfers
  through generated helpers. Unsupported source invocation backedges are
  refused. Direct raw FAST preparation has a separate planning boundary, as
  recorded in the [self-tail audit](self-tail-output.md#direct-fast-preparation).

## Region inputs, results and owners

The existing [FAST types](../js/ast/types.ts) provide the relevant constructs.
Names below stand for binding or target identities, not printed identifiers.
The pseudocode abbreviates an absent `else` as an empty, zero-result yield.

| Construct | Inputs and normal results | Transfer ownership |
| --- | --- | --- |
| Ordinary function `F` | Parameters, rest and established captures are available to its body. Each invocation has fresh invocation-local values. | `return F(v)` finishes that invocation. A nested ordinary function has its own return owner. |
| Expression/result block | Reads established bindings in scope; yields its declared ordered result signature. It creates no invocation. | An owning return or loop transfer can cross it; that path supplies no normal block results. |
| Conditional | Evaluates its test once; the selected arm supplies the common normal result signature. An unchanged binding supplies its incoming version. | Abrupt arms bypass the join and following continuation. |
| Loop `L` | Entry values initialize immutable iteration parameters. Input and exit-result signatures are independent. | `continue L(values)` supplies all next inputs simultaneously; `break L(values)` supplies its results and resumes after `L`. |
| Source switch | Reads the discriminant and reached labels; case and no-match paths can carry updated outer bindings. | Its break owner differs from an enclosing loop's continue owner. Break-capable switches use a one-pass FAST loop; terminal switches lower directly to conditional value chains. |

Lexical region inputs are established bindings, not extra formal parameters.
Branch locals stay local; zero results differ from one `undefined` result.

FAST records `yield`, function return, loop transfer and throw explicitly.
EDAG encodes them through dependencies, conditionals, sharing and helper graphs,
without new switch, loop or return operations. The
[construction contract](../edag/from_fast/loops.md) specifies completion relay;
[preparation](../js/ast/prepare/README.md) establishes all transfer operands
before slot writes, so dependent updates read one old snapshot.

Correctness preserves successful values, required failures, conditional
evaluation, allocation sharing and invocation lifetimes. Under the
[failure policy](../../spec/principles/README.md#failure-is-one-outcome), the
first failure, its payload and prior work are not language observations and
require no diagnostic-order barriers. Graph identity has its own normalization
domain.

Some native JavaScript witnesses additionally assert a particular selected
exception or callback trace, including the
[deferred first-demand](serializer/value/deferred_tail_calls.proof.mjs) and
[immutable-join](../js/ast/prepare/immutable_joins.proof.mjs) checks. Those stronger
witness assertions help detect placement errors in the named profiles; they do
not extend the language's failure-payload or prior-work contract.

## Audit of the reference cases

The source-profile column describes current source admission, with
the explicit-return wrappers above. Ordinary functions admit existing
terminating guards and conditionals with normal and owning-return paths,
joining at most one outer binding. Loop bodies retain their broader profile.

| Case | Required normalized meaning | Current source profile |
| --- | --- | --- |
| 1. Conditional expression | Select `a` or `b` once and supply one result. | Admitted. |
| 2. Expression blocks | Only the selected block establishes its local `x` or `y`; its result feeds `r0`. | Admitted for these immediate-call shapes. |
| 3. Terminating guard | True returns `f()` from `F`; false reaches the following `g()` return. | Admitted. |
| 4. Partly returning conditional | `x` stays local. The inner return exits `F`; both normal outer paths reach one following `c()` call. | Admitted with targeted early returns and one shared normal continuation. |
| 5. Sequential reassignment | Keep `a0`, the established `f(a0)` result, and fresh `a1`; the suffix reads their respective versions. | Admitted. |
| 6. Conditional reassignment | Join one `a1`: true supplies `a0 + 2`, false supplies `a0`; call `f(a1)` once afterward. | Admitted with normal arms, an optional `else` and an explicit following function terminator. |
| 7. Reassignment with an early return | Only normal paths join `z1`; the inner return skips the continuation using it. | Admitted with at most one written outer binding and an explicit following function terminator. |
| 8. Loop with break and continue | Loop state `(a,b)` and results `(a,b)` have explicit ordered signatures. Break supplies the updated `b`. | Admitted. |
| 9. Loop with an owning return | A break supplies loop state to the suffix; `return m(a)` leaves `F` and bypasses that suffix. | Admitted. |
| 10. Conditional loop | Test before each reached iteration, including zero iterations; false supplies the current loop state to the suffix. | Admitted with an explicit following function terminator. |

### Cases 1–3: values, regions and a terminating guard

Case 1 is a one-result conditional, represented by EDAG's `?:`. Case 2 adds
arm-local definitions. Its IIFE can become a result region only under the
immediate-call/capture rules: its return then yields the local result,
without returning from the enclosing function. Case 3 instead exits `F`:

```text
if (a) { return F(f()) } else { yield() }
return F(g())
```

Its value form is `a ? f() : g()` inside `F`; only false reaches `g`.
[Guard proofs](parser/func.proof.f.mjs), `guards`, pin this graph shape.

### Cases 4–7: one normal continuation and immutable versions

Case 4 has two normally completing paths to a zero-input continuation
`K() = c()`: outer false, or `f()` reached and `x.a()` false. Returning
`x.b()` bypasses `K`. Establish `f()` once; repeating it can change the
identities used by both member calls.

Case 5 needs no join: establish `a0 = 0`, required `x = f(a0)`, then fresh
`a1 = a0 + 1`, and return `F(g(a1) + x)`. Assignment changes the current
version, not established `x`. Write/capture analysis precedes normalization.

Case 6 adds a one-result join, followed by one call:

```text
required a0 = 0
a1 = if (b) { yield(a0 + 2) } else { yield(a0) }
return F(f(a1))
```

The alternative `b ? shared(a0 + 2) : shared(a0)` may agree in execution;
aliasing `f` does not make its two calls one graph node.

In Case 7 the continuation has a real input:

```text
K(z) = c(z + 5)

required z0 = 0
z1 = if (a) {
    required x = f()
    if (x.a()) { return F(x.b()) } else { yield() }
    yield(z0 + x.c())
} else {
    yield(z0)
}
return F(K(z1))
```

`K` denotes the suffix, not a required function allocation. A helper can pass
immutable `z` without capturing mutable outer state or branch-local `x`.
Multiple helper calls need a sharing argument beyond result equality.

### The nested `m` example

The same rule applies to the task owner's variant:

```js
if (a) {
    const x = f()
    m = x.a
    if (x.b) { return x.c }
}
return g(m)
```

Inside owner `F`, its input is `m0` and its normal result is `m1`:

```text
m1 = if (a) {
    required x = f()
    required m2 = x.a
    if (x.b) { return F(x.c) } else { yield() }
    yield(m2)
} else {
    yield(m0)
}
return F(g(m1))
```

The returning path still requires `x.a`: deleting its failure could invent a
successful return. This does not expose the first failure. Only normal paths
supply `m1`; the returning arm supplies no placeholder.

The original source spelling is admitted. Its branch return retains `F` as a
targeted statement, and the normal paths join the selected `m` before one
following call. The supplied normalized FAST fixture and the source-derived
graph execute through public FJS source and code-only output, preserving that
owning return. The separate
[source-profile work](../edag/to_fast/source/loops/todo/general-source-profiles.md)
also covers parameterized `K(z)` output and serialization of its reparsed graph.
Source admission and graph-to-source reconstruction remain separate boundaries.

### Cases 8–10: loop state, results and owning returns

Case 8's corrected transfer structure is:

```text
(ra, rb) = loop L(a = 0, b = 1) -> (ra, rb) {
    if (x(b)) { break L(a, b + 1) } else { yield() }
    if (x(a)) { continue L(a + 2, b) } else { yield() }
    continue L(a + b, b + 1)
}
return F(c(rb, ra))
```

Break carries updated `b + 1`. Continue skips the suffix and snapshots every
next operand before slot writes. The recursive sketch illustrates the state;
it does not itself establish bounded-stack JavaScript execution.

Case 9 has two distinct exits:

```text
ar = loop L(a = 0) -> (ar) {
    required a1 = a + 1
    if (x(a1)) { break L(a1) } else { yield() }
    required a2 = a1 + 1
    if (x(a2)) { return F(m(a2)) } else { yield() }
    continue L(a2 + 1)
}
return F(c(ar))
```

The `m` path leaves `F`; only break reaches `c`. The reference includes
`return loop0(0)`. Moving `c` into a helper is an encoding choice that must
preserve owners, evaluation regions and sharing, not the meaning of break.

Case 10 tests on entry and after each continue, including zero iterations.
If an admitted condition expression updates bindings, their latest versions
survive both true and false exits. Its fragment needs an explicit final return
when wrapped as a function.

Existing [source-loop proofs](../edag/to_fast/source/loops/proof.f.mjs),
`sourceLoopTransfersKeepStateAndFirstParseFixedPoints` and
`sourceFunctionExitsKeepTheirOwnersAndFirstParseFixedPoints`, cover transfers,
owning returns, nested loops and wide state signatures. The shared
[sugar proofs](../js/ast/sugar/proof.f.mjs) separately cover state selection,
conditional joins inside loop bodies, fresh snapshots and required failures.

## Switch dispatch, execution and transfer owners

Dispatch evaluates the discriminant once, then reached labels in source order
using strict equality until the first match. Skip later labels after a match.
No match selects default, or normal exit when absent. In general JavaScript,
default's written position does not stop the label search. Reached expression
updates flow to the selected body or no-match continuation.

Execution starts at the selected body. Normal completion enters the next body
without testing its label; the final normal end exits the switch. Break exits
its switch, continue targets the enclosing loop, and return leaves its function.

These general rules do not expand [current switch admission](../../spec/control-flow/switch/README.md):

- Outside loops, braced cases terminate. A final default makes the switch
  terminate the function body; without one, the no-match path reaches the
  following function-body terminator.
- Inside loop bodies, every case path exits explicitly. Break supplies the
  switch's normal results; continue belongs to the enclosing loop. Existing
  normalization uses a one-pass FAST loop with a distinct switch target `S`.
- Source fall-through, non-final default and direct module-level switch remain
  outside the current admitted profile.

For an enclosing loop `L` and function `F`, the owners remain distinct:

```text
break S(values)     -> resume after switch S
continue L(values)  -> start the next iteration of L
return F(value)     -> finish F
```

Unmatched dispatch can break `S` with unchanged incoming values. A matched
case can instead supply its changed outer versions. A nested loop's break
belongs to that loop, not `S`. Neither a keyword search nor an invented
ordinary function for each case establishes these relationships.

General fall-through needs explicit case-entry edges. In
`case 0: m += 1; case 1: m += 2; break; default: m += 3`, dispatch to case 0
passes its updated `m` into case 1; dispatch directly to case 1 supplies the
incoming `m`. The common exit receives `(m0 + 1) + 2`, `m0 + 2`, or `m0 + 3`
respectively for case 0, case 1 and no match. Preserve those operations rather
than assuming arithmetic reassociation. The current
corpus can build such control flow directly in FAST; automatic source
fall-through admission and the source-to-FAST encoding are separate work.

## Return ownership and immediate-call audit

The two source return constructors retain the same lexical `FunctionTarget`;
their storage positions have different normalization roles. They are not
interchangeable input constructors. The current mapping is:

| Boundary | Current owner and normalization |
| --- | --- |
| Parsed function | Parser [`entered`, `returned` and `closed`](parser/module.f.mjs) assign the function target. Returns inside loop regions and ordinary join arms are targeted `SourceStatement`s, including through nested guards and switches. An ordinary function's terminal result remains a `SourceExit`. |
| Statement return | Sugar [`normalizedBlock`](../js/ast/sugar/module.f.mjs) keeps `['return', F, value]` as an abrupt exit. No following normal join consumes a result from that path. |
| Terminal source return | Sugar `normalizedExit` produces a local one-result yield in the admitted terminal-result profile. `functionValue` restores `['return', F, value]` at the ordinary function boundary. Join-arm returns do not enter this result path. A yield in this intermediate body is not an implicit source return. |
| Immediate function call | Sugar `leaf` eliminates an eligible zero-argument call only after checking for other owning returns and invocation bindings. It excludes the final return from that check, but still scans a terminal loop. A required invocation boundary remains a function call. |
| Immediate call with enclosing writes | Parser `blockCall`, `closed` and `internalReturn` apply the existing invocation/capture limits. Sugar `enclosedValue` exports the expression result and changed outer binding versions on normal completion; subsequent code reads those immutable versions. |
| Normalized FAST to EDAG | [`functionValue` and `controlTask`](../edag/from_fast/module.f.mjs) consume explicit owners. A local yield resumes the suffix; a return exits its function. Loop [completion helpers](../edag/from_fast/loop/completions/module.f.mjs) relay that owner across generated helpers. |
| Prepared target code | Common [`prepareValue` and `exitValue`](../js/ast/prepare/module.f.mjs) hoist outward transfers into the containing flow. JavaScript's [`blockExpression`](../js/ast/serializer/module.f.mjs) may then spell a local result block as an IIFE; [Rust](../rust/serializer/module.f.mjs) can use a lexical block. These spellings do not change a source function's return target. |

The normalization contract keeps this distinction at its producer boundary.
Terminal source results may become yields only where the function return will
be restored, or where admitted immediate-call elimination makes that result
local. Moving a targeted statement return into that path requires an ownership
proof; changing its array tag or storage position alone is insufficient.
An ordinary function, including a source IIFE, owns its returns. A normalized
value block creates no invocation, so `return F(v)` can cross it. A serializer
must not wrap that outward transfer in a new function and thereby catch it.

A switch with no normal alternative has a terminal FAST loop exit and no
normal result signature. Its enclosing block preserves that exit instead of
substituting an unreachable empty yield. This matters inside a one-result
conditional: an owning return bypasses that result, rather than supplying an
empty or placeholder value. A switch with a normal path retains its ordinary
statement-loop results.

For example, the admitted source
`n => { const r = (() => { n = n + 1; return 10; })(); return [n, r]; }`
returns `[3, 10]` at input `2`: the inner return finishes the immediate call,
while the outer return reads the updated version of `n`. The
[parser ownership proof](parser/control_flow.proof.f.mjs),
`immediateReturnKeepsItsOwnOwnerWhileWritesEscape`, pins that distinction.
[Binding proofs](parser/bindings.proof.f.mjs), `expressionBlockAssignments`
and `expressionBlockAssignmentBoundaries`, cover admitted writes and retained
invocation boundaries. [Native output proofs](serializer/value/control_flow.proof.mjs),
`immediateWriteKeepsOneSharedAllocation` and `expressionJoinKeepsSelectedWrite`,
check shared allocations and selected versions after output. Those write
permissions remain; a private continuation does not authorize mutable captures.

### Graph normalization boundary

This audit retains the current source constructors and EDAG operations. It
does not add a general return-constructor rewrite or another control-flow IR.
Simple expression bodies and explicit final returns, local terminal IIFEs and
their expression forms, and terminating guards can already produce the same
analysis-normalized graph. That observation about those forms is not a general
canonicalization law for arbitrary statement returns or function boundaries.

The existing [graph contract](architecture.md#graph-and-output-contracts)
continues to distinguish semantics from graph identity. Helper insertion can
introduce function/call nodes; required anchors, shared reads and capture
compaction have their named normalization domains. Output must parse and
preserve successful results, required failures, sharing and invocation
lifetimes. This audit adds no raw graph/hash equality or general graph/text
fixed-point requirement. Explicit function returns remain required.

### First immutable join profile

The existing [_controlFlowFunctions.parameterizedJoin](../edag/from_fast/control_flow.proof.f.mjs)
is a concrete supplied normalized FAST input to `prepareFunction`:

```text
F(selected, stop, operation):
    z = if (selected) {
        if (stop) { return F(42) } else { yield() }
        yield(3)
    } else { yield(0) }
    return F(operation(z + 5))
```

It has one normal result, an abrupt path owned by `F`, and one shared normal
suffix. Direct common preparation now extracts a private parameterized
continuation instead of declaring a conditional-result slot. The routes remain
distinct:

| Input route | Current output for this corpus |
| --- | --- |
| `parameterizedJoin` directly through `prepareFunction` | Immutable continuation and guarded calls; no `let` or `while`. |
| The same join through `fromFast`, `fromAnalysis` and default preparation | The canonical one-pass wrapper is recovered; an immutable continuation and guarded calls need no `let` or `while`. |
| Public FJS source output for the same graph | Immutable continuation and guards; parser readback, execution and reserialization preserve the supplied profile. |
| `parameterizedHelper` through either route | Immutable continuation and guarded calls; no `let` or `while`. |
| Source `expressionJoinKeepsSelectedWrite` | An already supported immutable expression profile. |

The [common join pass](../js/ast/prepare/joins/README.md) implements the direct
one-result, non-loop profile. Default preparation also uses
[one-pass invocation recovery](../js/ast/prepare/one_pass/README.md) to expose
that profile after graph conversion. Its immutable continuation spelling is:

```js
export default (selected, stop, operation) => {
    const shared = z => operation(z + 5)
    if (selected) {
        if (stop) { return 42 }
        return shared(3)
    }
    return shared(0)
}
```

Only the normal suffix moves into `shared`. The early return stays in `F`;
neither a placeholder result nor a call to `shared` is introduced on that
path. The initial profile uses required immutable definitions, no lazy definition
or loop transfer in the extracted region, and one joined value. Operand value
blocks and value-region conditionals retain their existing plan. Ordinary nested
functions keep their own owners; their capture expressions are checked in the
constructing region. Functions with a self binding retain their existing
lowering so the new helper cannot hide an owning self-tail call or its alias.
The following criteria govern the replacement:

- Evaluate the test once, retain reached required work and skip unselected work.
- Pass the selected result to one private continuation body. Do not duplicate
  a call or allocation merely because its syntax is equal.
- Capture established immutable bindings; pass branch-local results as inputs.
  Each invocation retains its own values and allocation sharing.
- Keep abrupt transfers under their existing owner. Introducing a helper must
  not hide an owning self tail call; eligible self tails in any output function
  still require common `while` lowering. This nonrecursive witness does not
  complete the [broader self-tail audit](self-tail-output.md).
- Preserve the function's arity and existing source admission. Have JS and Rust
  render the common plan; do not teach each writer to rediscover the join.

The existing `nested` and `parameterizedJoin`/`parameterizedHelper` fixtures
provide the semantic backstop. Their
[native tests](serializer/value/control_flow.proof.mjs),
`suppliedNestedJoinKeepsNativeReturnOwnership` and
`suppliedParameterizedContinuationsKeepNativeInputs`, cover both normal inputs,
the bypassing return, shared allocations, fresh invocations and repeated public
source writes. [Direct preparation proofs](../js/ast/prepare/joins/proof.f.mjs)
and [native JavaScript checks](../js/ast/prepare/immutable_joins.proof.mjs)
exercise the new boundary, including unsupported-profile identity, early
returns, selected failures, required prefixes, rest/capture metadata, allocation
sharing, fresh invocations and retained self-tail lowering. The
[Rust fixture generator](../nanvm/fast/immutable_joins/module.f.mjs) prepares
both the direct FAST inputs and their full `fromFast`/analysis/`fromAnalysis`
route; its [native tests](../../nanvm/harness/tests/immutable_joins.rs) execute
the continuation, owning return and shared captured allocations, plus a genuine
self-tail loop. The [graph-route JavaScript proofs](../edag/to_fast/immutable_invocation.proof.mjs)
check the same owners and allocation lifetimes, public source
readback, and deep genuine loop/self-tail execution.

The JavaScript writer omits empty alternatives, retaining the existing guard
spelling accepted by the FJS parser. Public source output now uses the same
one-pass recovery and immutable continuation as default preparation. Its
[native readback proofs](serializer/value/immutable_source_joins.proof.mjs)
check parsing, execution and reserialization of the supplied `K(z)` and nested
`m` profiles without imposing graph/hash equality. Explicit source returns
remain required. Recovery uses the existing invocation-root matcher and inverse
to restore the owning returns and required entry snapshots. Source recovery
requires every moved decision to have an empty normal alternative and a
terminating then block; broader normal or inverted inner decisions retain their
invocation loop. A read of the inverse's fresh
self binding signals a backedge, so that wrapper is retained. Recovery also
retains the original function when the immutable-join profile cannot consume
the result, including lazy, nested-loop and hidden value-transfer regions.
Removing the loop scope requires fresh root identities for iteration inputs
and all lifted declarations. The direct join pass applies the same restriction
to flattened false-arm declarations. Valid shadowing that would collide at the
function root retains its original scoped lowering; no renaming is introduced.
Additional result signatures, source reconstruction outside the named profiles
and remaining genuine lazy definitions retain their existing boundaries.
Mutable-storage optimizations remain separate work.

## Source boundaries and reconstruction gaps

Source coordination now preserves lexically local invocation loops with normal
joins and a shared suffix after trying the established source plans. Common
preparation uses its existing private loop state/result storage. Nearest-loop
ownership, value-region transfer and statement-block checks remain; so do final
graph and genuine-lazy checks. These source-output profiles do not change source
syntax admission or optimization.

After retaining the established loop plans, the
[`recursiveFunction` / `resultBlock` fallback](../edag/to_fast/source/loops/module.f.mjs)
refuses a possible `continue` to the invocation's exact loop target before
inverse reconstruction. Break-only and other one-pass wrappers can still become
terminal values, preserving ordinary self calls and returned self identity.
The [fallback proofs](../edag/to_fast/source/loops/fallback.proof.f.mjs) and
[transfer-query proofs](../js/ast/control/proof.f.mjs) pin this boundary. The
query traverses nested regions and evaluated captures, skipping ordinary
function bodies. It is structural and can conservatively refuse
an unreachable owning backedge.

The [self-tail output audit](self-tail-output.md) maps current routes, native
witnesses, source refusals and bounded shared-recipe loop planning.
Every self tail-call evaluation must serialize as a `while` transfer, including
in generated helpers. Existing
[tail eligibility](../edag/to_fast/README.md#tail-call-eligibility) covers selected
profiles. The lower-level fallback witness previously reconstructed recursive
JavaScript that overflowed at input 100,001; its raw spelling also failed FJS
parsing. The public graph route already normalized that graph back to `while`,
so this was not an established accepted-public-output regression. The source
coordinator now refuses that raw input; the
[native public-output proof](serializer/value/control_flow.proof.mjs),
`suppliedFallbackBackedgeKeepsDeepPublicLoopsAfterReadback`, retains deep
execution through two source generations. Direct raw FAST preparation still
requires producers to supply planned loops. Non-tail uses, ordinary self identity
and invocation-local memo lifetimes still matter; profile extensions do not make
arbitrary calls loop transfers.

The shared-tail, prefix, observed-rest and generated-helper fixtures now execute
deep transfers through `while` in public source output as well as code-only
output. Retaining a demanded-prefix graph does not admit genuine lazy FAST
remaining in the source plan. New output profiles have no blanket graph/hash
or fixed-point guarantee. Ordinary shared sequences placed as bindings now
reach public source output, including the reparsed parameterized join and the
source-origin numeric terminal-loop join. Established canonical domains stay
exact. The [independent-recipe witnesses](serializer/value/independent_tail_recipes.proof.mjs)
also cover scalar/vector selectors, selected failures and immutable invocation
snapshots through two public source generations. The snapshot's array and
escaped reader remain in their creating invocation. Remaining genuine lazy FAST
definitions are still refused.

Supplied FAST can also return from its owning function during a lazy
initializer's first demand. Memo getters transport an owning self tail call as
evaluated arguments in a private completion, rather than invoking the owner
recursively. Nested getters forward that completion; the owner restores the
direct self return before invocation-loop normalization. The deferred-tail
fixtures execute this path deeply in JavaScript and Rust. The existing
`nestedRecipe` and `normalPayload` graphs now reach public FJS source through
immutable first-demand result joins. Recovery processes later dependencies
before prerequisites and may descend into their sole demanding conditional arm;
declaration scopes and the existing ordered-demand checks remain mandatory.
Ordinary function bodies and loop boundaries remain opaque to that descent.
The [join proofs](../edag/to_fast/join/proof.f.mjs) pin scope and demand limits;
the [native deferred-tail proofs](serializer/value/deferred_tail_calls.proof.mjs)
parse, execute and reserialize both graphs through two source generations at
100,001 transfers. Shared normal payloads keep opaque tags as data, share one
allocation within an invocation and allocate fresh payloads in later calls.
Skipped failing transitions stay skipped, and reached failures still fail.
These named output profiles do not admit arbitrary lazy storage. Ordinary
source cases 4 and 7 have their separate admission and owning-return proofs.

The baseline output model uses immutable bindings and parameterized
continuations for ordinary branches, with mutable state for `while` lowering.
Broader use of mutable output variables is an optional future optimization;
it is not required to represent normal joins. The host corpus's
`expressionJoinKeepsSelectedWrite` already emits const/IIFE/conditional code
without `let` or `while`. The [first immutable join profile](#first-immutable-join-profile)
now lowers a supplied statement conditional to a private continuation in direct
common preparation. Default and public source preparation can recover its
canonical graph-route wrapper too; genuine source loops and other result-bearing
regions retain their existing plans. The private continuation preserves owners,
selected evaluation and observable sharing, while its insertion may change the
graph's shape. This baseline
does not change source assignment admission or declare existing slot output
semantically incorrect.

Reusing storage after a variable's last use and other mutable-variable
optimizations are out of scope. This work targets correct generated programs
and self-tail execution without recursive stack growth, including generated
helpers.

## Conformance evidence and remaining gates

| Corpus | What it establishes |
| --- | --- |
| [Parser/source](parser/control_flow.proof.f.mjs) | Pins conditional admission, recognized-but-refused switch fall-through, switch-break syntax limits, explicit function returns, normal region continuation, and immediate return ownership with enclosing writes. [Normal conditional proofs](parser/normal_if.proof.f.mjs) and [mixed-return proofs](parser/mixed_if.proof.f.mjs) cover immutable joins, exact owners and remaining admission limits. |
| [Normalized FAST](../edag/from_fast/control_flow.proof.f.mjs) | Nine groups cover nested joins/returns, allocation sharing, parameterized continuations, current multi-state transfers, iteration snapshots, owning loop returns, switch fall-through edges/owners and conditional-loop iterations. They construct FAST independently of source admission. |
| [JavaScript host](serializer/value/control_flow.proof.mjs) | Executes admitted reference cases, immediate writes, expression joins and deep self-tail/helper loops through code-only and FJS source outputs. Supplied nested joins, parameterized continuations, shared-tail prefixes, rest and named exports also execute through both writers; deep shared-tail transfers use `while`. |
| [Deferred owning tails](../edag/from_fast/deferred_tail_calls.proof.f.mjs) | Directly constructed FAST covers lazy completion ownership, nested recipes, aliases, argument snapshots and memo lifetimes. [Native JavaScript](serializer/value/deferred_tail_calls.proof.mjs) and [native Rust](../../nanvm/harness/tests/deferred_owning_tail_calls.rs) execute deep transfers without recursive stack growth. JavaScript also checks `nestedRecipe` and `normalPayload` through two public source generations. |
| [Source fallback](../edag/to_fast/source/loops/fallback.proof.f.mjs) | Retained loop plans precede the structural owning-backedge refusal. One-pass inversion preserves ordinary self calls and identity; the [native public route](serializer/value/control_flow.proof.mjs) separately preserves parser readback and deep `while` execution. |

Result equality does not establish graph identity. Source parsing, graph/source
reconstruction and native target execution remain separate gates; Rust text is
not native Rust execution. Normalization domains and subsequent fixed points
follow the [architecture contract](./architecture.md#graph-and-output-contracts).
The next step must name its boundary, preserve explicit returns and sharing,
and expose unsupported profiles without introducing another serializer model.
