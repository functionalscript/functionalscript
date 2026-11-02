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
include `nestedRecipe` and `normalPayload`, which now reach public source through
the bounded immutable result recovery described below. JavaScript and Rust also
execute their deep owning tail transitions. The
[native proof](../../../../../compiler/serializer/value/deferred_tail_calls.proof.mjs)
checks both source generations, conditional work, sharing and opaque normal
payloads. These source profiles retain the common owning-completion contract
through memo getters.

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

### Shared normal recipe results

The bounded target is the existing deferred-tail `normalPayload` graph. Its
initializer can either complete normally with `[tag, [n]]` or return through
the owning function's tail transition. A normal value is read twice: both
reads must share one allocation, while later invocations create fresh payload
and inner arrays. Tags such as `tail`, `return` and `normal`, and opaque input
values, remain ordinary payload data.

After a normal-result join, first-demand recovery must distinguish a deferred
declaration from an executed demand. It works from later dependencies toward
their prerequisites. A definition can move into its first referencing
conditional only when the test, other arm and following continuation do not
use it. Recovery can descend further into that sole demanding arm until the
existing ordered-demand proof establishes its first executed use. Each move
retains the initializer's dependencies, its own binding identity and declaration
order; it cannot cross a rebinding or change a captured value. A deferred
declaration alone does not prove that its initializer is demanded. Required
calls, lookups and expansions retain their order relative to the first demand,
and unselected work remains unevaluated. Ordinary nested function bodies and
loop boundaries remain opaque to this conditional descent.

Normal completion must preserve one immutable shared value; owning returns
retain their function target and bypass following normal-result construction.
Source must parse and reserialize through the unchanged front end, retain
explicit returns and `while` for self-tail transitions, and execute correctly
at input `100_001`. Proofs must include opaque packet-like tags, shared and fresh
allocations, conditional failures, lexical captures and both source generations.
This is a semantic source-readback contract, without a general graph/hash
fixed-point guarantee or admission of arbitrary lazy storage.

### Stack-safe fallback boundary

The source coordinator first retains the established scalar, plain, terminal
and lexically local loop plans. Its remaining inverse reconstruction must not
turn a possible invocation backedge into a recursive JavaScript call. A
`continue` to that exact invocation loop target is a potential backedge;
`break` alone is not. Target matching follows object identity through value
regions, nested loops and construction captures. Ordinary nested function bodies
have their own transfer owners and remain opaque to this query.

Outside the retained profiles, a possible owning backedge is an explicit
unsupported result before inverse reconstruction. This is a structural limit:
an unreachable but still present `continue` can also be refused. A loop without
that owning continuation can retain the existing one-pass reconstruction,
including owning value returns and ordinary self values or calls.

The [shared fallback fixture](../fixtures.f.js) has an owning return in a required value prefix,
followed by a result-bearing terminal decision and a genuine backedge. Before
the guard, direct coordination reconstructs recursive JavaScript that returns
`7` shallowly and overflows at input `100_001`; its raw spelling also fails FJS
parsing. The public graph route already normalizes the same input back to a
valid `while`. This is evidence for the coordinator boundary, not a confirmed
public-output regression.

Proofs must preserve the shared transfer query's default behavior, distinguish
breaks from continues and exact target identities, retain valid one-pass forms,
and refuse the low-level witness. The public graph must still parse, reserialize
and execute deeply through two source generations using its existing loop plan.

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
- [x] Reconstruct the shared normal `normalPayload` result with immutable
      first-demand dependencies; preserve opaque values, conditional work,
      allocation identity and owning returns through deep source readback.
- [x] Guard inverse source reconstruction against possible owning backedges;
      preserve retained loops and one-pass forms, with concrete lower-level
      refusal and public deep-readback witnesses.
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
