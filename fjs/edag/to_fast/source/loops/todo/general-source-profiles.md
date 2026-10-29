## General source profiles for supplied invocation graphs

**Priority:** P2
**Status:** open

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

`tryStringify(profile)` returns
`['error', 'a factored terminal continuation outside the source loop profile']`.
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

The current terminal-tree fold requires a terminal decision's enclosing exit to
be an empty yield. It therefore refuses this factored suffix, and recursive
source reconstruction cannot recover its source value form. The test may still
fail or perform required work; dropping it because its arms agree would change
evaluation. Duplicating a shared call or moving arguments before that work would
also change the graph's contract.

The source-loop proof `unsupportedFactoredInvocationProfilesReturnReasons`
includes this profile, required-prefix and observed-rest variants, plus a shared
allocation case. It pins the current explicit refusal.

### A demanded lazy terminal prefix

`lazyTerminalPrefixesRetainTheirRecursiveSourceFallback` constructs a canonical
invocation root with a lazy array definition. Its terminal test reads the array's
numeric element, and its completed result reads the same array twice:

```js
['define', shared, ['array', [['ref', state]]], 'lazy']
// test: ['>', ['.', ['ref', shared], 0], 0]
// break result: ['array', [['ref', shared], ['ref', shared]]]
```

The source coordinator currently reifies this loop as recursion, preserving the
lazy definition. The proof checks both the original and converted graphs at
three transfers and immediate completion: both return `[[0], [0]]`, with the
two result elements referencing one array. This is an actual first demand and
shared allocation, not an unused declaration. It is a supplied FAST fixture;
ordinary source `const` declarations establish required definitions.

Required-prefix terminal recognition cannot simply accept every lazy definition.
An unselected initializer must remain unevaluated, the first reached demand must
retain its order relative to calls and failures, and later demands must read the
same invocation-local value. Loop re-entry must recreate iteration-local storage.

### Other profile boundaries

`sourceLoopRetentionChecksLexicalTransferRegions` also records the existing
boundary for statement blocks, outer-loop transfers and returns or loop transfers
escaping value regions. Broader source spelling must preserve exact owners and
normal continuations through those regions. Reifiable forms keep their recursive
fallback; non-reifiable forms retain the explicit `Result` error above.

### Tasks

- [ ] Retain normally completing decisions followed by one common tail
      continuation, without duplicating its evaluation or dropping reached work.
- [ ] Extend demanded lazy terminal prefixes through a shared plan that preserves
      first-demand order, memo identity, captures and per-invocation lifetime.
- [ ] Extend additional structured or nonlocal profiles only with explicit owner
      and source-representability contracts; keep existing refusals for other
      supplied profiles.
- [ ] For each admitted profile, verify strict graph/text cycles from the first
      source parse, deep source execution, required failures, captures, rest,
      arity and unchanged prior layouts across the shared JS/Rust path.

### Related

- [Source loop output](../README.md)
- [Source-loop proof boundary cases](../proof.f.mjs)
- [Shared terminal fold](../../../../../js/ast/loop/terminal/module.f.mjs)
- [Common preparation](../../../../../js/ast/prepare/README.md)
