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

The source-origin numeric join in the host corpus's
`terminalLoopHasNoSyntheticFailure` also reaches public source output. Its
terminal loop preserves early returns, and its EDAG contains no invented throw.
Source and code-only output execute the same results.

Remaining genuine lazy FAST definitions still fail the existing `lazyReason`
check. These successful shared-sequence profiles establish no general graph
identity, stable hash or graph/text fixed-point guarantee. The established
canonical profile contracts remain unchanged.

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
An unselected initializer must remain unevaluated, the first reached demand must
retain its order relative to calls and failures, and later demands must read the
same invocation-local value. Loop re-entry must recreate iteration-local storage.

### Other profile boundaries

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
