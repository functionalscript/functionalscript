## General source profiles for supplied invocation graphs

**Priority:** P2
**Status:** wip

### Problem

Source output remains partial for canonical FAST/EDAG invocation graphs outside
the admitted [source loop profiles](../README.md). Existing recursive fallbacks
and explicit refusals preserve correctness, but some eligible tail evaluations
do not obtain bounded-stack source output. Code-only JavaScript/function text
and Rust already consume their general common-preparation plan.

These profiles are supplied graphs. Duplicate calls or allocations written in
source have distinct identities; they are not examples of a shared graph node.
The completed source-language loop integration does not imply arbitrary graph
representability or new syntax.

### A decision followed by one shared continuation

This canonical EDAG profile uses the same `call` object in both conditional arms:

```js
const call = ['()', ['self'], [
    ['-', ['arg', 0], 1],
    ['+', ['arg', 1], 1],
]];
const profile = ['=>', 2, [], ['?:',
    ['>', ['arg', 0], 0],
    ['?:', ['===', ['arg', 1], 0], call, call],
    ['arg', 1],
]];
```

The placed FAST contains a result-free decision whose two arms complete with
empty yields, followed by one common continuation:

```js
{
    statements: [['if', [], test,
        { statements: [], exit: ['yield', []] },
        { statements: [], exit: ['yield', []] },
    ]],
    exit: ['continue', target, nextInputs],
}
```

The terminal-tree fold alone cannot recover this factored suffix. After the
established source plans, the coordinator now retains the lexically local loop
and common preparation emits it with existing private state/result storage.
`tryStringify(profile)` succeeds with `while` output. Its decision remains
before the shared continuation: dropping the test or duplicating a shared call
would change required evaluation or sharing.

The [shared-continuation proof](../shared_continuations.proof.f.mjs)
`factoredInvocationProfilesKeepSelectedWorkAndSharedResults` covers this profile,
required-prefix and observed-rest variants, plus a shared allocation case. The
[host corpus](../../../../../compiler/serializer/value/control_flow.proof.mjs)
also executes deep source and code-only output, nested `m` joins, parameterized
`K(z)` continuations and named exports. This extends output profiles, not source
syntax or admission.

### Shared sequences after placement

The supplied `K(z)` join fixture now emits valid FJS whose native execution
preserves the selected input, early return and shared result. Its reparsed graph
can also be serialized again. Common FAST placement establishes ordinary shared
sequences as bindings, so source admission accepts those placed values without
a separate graph-region ban. Required work and shared results keep their
existing placement and evaluation regions.

Public source preparation also recovers the canonical nonrecursive invocation
wrapper for `K(z)` and nested `m`, using the existing immutable-join pass.
Empty alternatives render as guards through the unchanged FJS grammar. The
[native source proofs](../../../../../compiler/serializer/value/immutable_source_joins.proof.mjs)
execute both the first output and its reserialization, preserving owners,
selected failures, sharing and invocation lifetimes. Genuine loops keep their
existing `while` profiles; this adds no graph/hash equality requirement.

The source-origin numeric join in the host corpus's
`terminalLoopHasNoSyntheticFailure` also reaches public source output. Its
terminal loop preserves early returns, and its EDAG contains no invented throw.
Source and code-only output execute the same results.

Remaining genuine lazy FAST definitions still fail the existing `lazyReason`
check. These successful shared-sequence profiles establish no general graph
identity, stable hash or graph/text fixed-point guarantee. The established
canonical profile contracts remain unchanged.

The [deferred-tail fixtures](../../../../from_fast/deferred_tail_calls/fixtures.f.mjs)
retain the public-source limit `normalPayload`; JavaScript and Rust execute its
deep owning tail transitions, but source output refuses its remaining lazy
placement. The dependent `nestedRecipe` now reaches source through the bounded
result join described below. The
[native proof](../../../../../compiler/serializer/value/deferred_tail_calls.proof.mjs)
records that current admission boundary without requiring a particular error
payload. Supporting these source profiles is separate from carrying tail
completions through memo getters.

### A demanded lazy terminal prefix

`lazyTerminalPrefixesRetainTheirInvocationLoops` constructs a canonical
invocation root with a lazy array definition. Its terminal test reads the array's
numeric element, and its completed result reads the same array twice:

```js
['define', shared, ['array', [['ref', state]]], 'lazy']
// test: ['>', ['.', ['ref', shared], 0], 0]
// break result: ['array', [['ref', shared], ['ref', shared]]]
```

The source coordinator now retains this supplied FAST loop and its lazy
definition unchanged. The corresponding EDAG emits `while` source after normal
graph placement; the proof checks its source readback at three transfers and
immediate completion. Both return `[[0], [0]]`, with the two result elements
referencing one array. This is an actual first demand and shared allocation,
not an unused declaration. Ordinary source `const` declarations establish
required definitions.

Retaining this loop does not widen final source validation: any genuine lazy
FAST definition that remains in the placed source plan is still refused by
`sourceReason`. The supported graph profile and arbitrary lazy FAST are
different boundaries.

Required-prefix terminal recognition cannot simply accept every lazy definition.
An unselected initializer's observable work must remain unevaluated, the first
reached demand must retain its order relative to calls and failures, and later
demands must read the same invocation-local value. Loop re-entry must recreate
iteration-local storage.

### Immutable invocation snapshots

The bounded target is `_independentTailRecipes().snapshots`: each invocation
constructs one `current = [n]` array and one reader closing over that array.
Tail transitions pass the reader to the next invocation. Completion returns
the current array twice, its reader, and the previous invocation's array.
The same allocation must satisfy all reads in its creating invocation; escaped
readers must keep that snapshot after later iterations and public calls.

Common tail planning may establish an inert prefix array, object or closure
construction as an immutable binding when all of its evaluated inputs are
invocation inputs or earlier established prefix values. Advancing only these
total constructions performs no observable call, lookup, coercion, spread or
failure. It must not advance a dependency that still requires first-demand
evaluation. Conditional work and failures retain their reached order, and an
unselected initializer with such work remains unevaluated. Ordinary nested
function bodies are not evaluated when constructing their closures.

The declaration stays inside its creating invocation's loop body. Public source
must retain explicit returns and a real `while`, parse through the unchanged
front end, and execute correctly after reserialization at input `100_001`.
Repeated reads share identity, later invocations allocate fresh arrays and
readers, and marked output has the same text as plain output. This is a semantic
source-readback contract, without a general graph/hash fixed-point guarantee.
An outer deferred binding is not an established input merely because it is in
scope. Remaining lazy definitions continue through their existing admission
checks.

### Dependent recipe joins

The bounded dependent profile is the existing deferred-tail `nestedRecipe` graph.
One lazy recipe depends on another recipe whose reached completion returns to
the owning function. Its generated helper result is shared by a conditional
test and following work; an already completed path skips that helper call.
Constructing the dependent array must not intercept an owning return or force
an unselected prerequisite.

Common result recovery may join a value conditional in an immediately following
required initializer into the preceding statement decision when both read the
same established test, without rebinding that test as a decision result. The
existing ordered-demand proof must establish that the conditional is the
initializer's first reached work. Normally completing arms yield an immutable
result; abrupt arms retain their exact return or loop owner.
The initializer and its following continuation remain one computation, using
that joined result. A shared helper call stays inside its selected arm and runs
once on first demand. Every binding moved into an arm must already be in scope
there, and an arm's locals must not capture its earlier outer dependencies.
Deferred declarations retain those dependencies transitively and cannot
silently become forward references.

Source output must parse and reserialize through the unchanged front end and
execute the original graph at input `100_001` using `while`. Companion cases
must verify skipped throwing work, reached failures, one shared normal result
and owning early returns. Remaining genuine lazy source profiles keep their
existing admission boundary. This is a semantic reconstruction contract, without
a general graph/hash fixed-point requirement.

### Other profile boundaries

The [independent terminal-recipe graphs](../../../tail/fixtures.f.js)
now use bounded common loop planning for general JS/function text and Rust.
Shared result forwarding now exposes their scalar, vector and selected-failure
selectors as existing source conditionals. Those profiles pass parser readback,
deep native execution and reserialization. The snapshot graph now also uses
immutable prefix bindings under the bounded contract above. General statement
blocks and nonlocal profiles keep their existing restrictions. The
[output audit](../../../../../compiler/self-tail-output.md) distinguishes these
routes and the existing one-pass source reconstruction evidence.

`sourceLoopRetentionChecksLexicalTransferRegions` also records the existing
boundary for statement blocks, outer-loop transfers and returns or loop transfers
escaping value regions. Broader source spelling must preserve exact owners and
normal continuations through those regions. Reifiable forms keep their recursive
fallback; non-reifiable forms retain the explicit `Result` error
`a factored terminal continuation outside the source loop profile`.

### Tasks

- [x] Retain lexically local normal decisions followed by one common tail
      continuation; emit and execute source without duplicating the continuation
      or dropping reached work.
- [x] Keep the demanded lazy-prefix graph in a `while` profile with its shared
      result, while preserving the supplied FAST definition during coordination.
- [x] Admit shared sequences established as ordinary bindings by common
      placement, including the reparsed `K(z)` and source-origin numeric joins,
      while preserving reached work and sharing.
- [x] Reuse shared normal-result forwarding to emit canonical independent-recipe
      selectors through existing source loop syntax; prove readback and deep
      execution while retaining genuine-lazy refusals.
- [x] Establish inert shared snapshot constructions as immutable invocation
      bindings; prove conditional-demand boundaries, capture and allocation
      lifetimes, source readback and deep loop execution under the contract above.
- [x] Reconstruct the dependent `nestedRecipe` graph with an immutable
      first-demand result join; preserve conditional work, sharing and owning
      returns through source readback, reserialization and deep execution.
- [ ] Extend remaining genuine lazy source plans only with a contract preserving
      conditional demand, memo identity, captures and per-invocation lifetime.
- [ ] Extend additional structured or nonlocal profiles only with explicit owner
      and source-representability contracts; keep existing refusals for other
      supplied profiles.
- [ ] Define and verify further graph/text cycle domains, including
      shared-continuation profiles, alongside deep source execution, required
      failures, captures, rest, arity and unchanged prior layouts across the
      shared JS/Rust path.

### Related

- [Source loop output](../README.md)
- [Source-loop proof boundary cases](../proof.f.mjs)
- [Shared terminal fold](../../../../../js/ast/loop/terminal/module.f.js)
- [Common preparation](../../../../../js/ast/prepare/README.md)
