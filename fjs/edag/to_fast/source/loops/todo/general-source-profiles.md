## General source profiles for invocation graphs

**Priority:** P2
**Status:** open

### Problem

Source output remains partial for canonical FAST/EDAG invocation graphs outside
the admitted [source loop profiles](../README.md). Existing recursive fallbacks
and explicit refusals preserve correctness, but some eligible tail evaluations
do not obtain bounded-stack source output. Code-only JavaScript/function text
and Rust already consume their general common-preparation plan.

Some profiles below are supplied graphs. Duplicate calls or allocations written
in source have distinct identities; those spellings are not examples of a
shared graph node. However, admitted non-terminating `if` source can also produce
a shared continuation that current source output refuses, as the next example
shows. Source-language loop integration does not imply arbitrary graph
representability.

### Admitted nested `if` with a shared following call

The task owner's example, wrapped as a complete module:

```js
export default (a, m, f, g) => {
    if (a) {
        const x = f()
        m = x.a
        if (x.b) {
            return x.c
        }
    }
    return g(m)
}
```

At `d80bfcae35dcd897ad3fba1bdd50001020ffa642`, this source parses, normalizes
to FAST, constructs EDAG and evaluates correctly. The EDAG itself is
serializable as DataJS, and Rust serialization succeeds. JavaScript source
output through `compileFile(noRuntime)` refuses it with:

```text
a factored terminal continuation outside the source loop profile
```

The required behavior is:

| Path | Evaluation |
| --- | --- |
| `a` is false | Skip `f`; call `g` with the original `m`. |
| `a` is true and `x.b` is false | Call `f` once; read `x.a`, then `x.b`; call `g(x.a)`. |
| `a` is true and `x.b` is true | Call `f` once; read `x.a`, then `x.b`; return `x.c` without calling `g`. |

`x` stays local to the selected branch. Only normally completing paths supply
the joined `m`; the inner return exits the owning function. The EDAG holds
one `f()` call node and one shared `g(joinedM)` call node. Reading `x.a` remains
required before the inner condition, including on the returning path.

#### Proposed first fix: retain structured statement FAST

The refusal is in the source adapter's
[`recursiveFunction` and `resultBlock`](../module.f.mjs), before JavaScript
rendering. `directInvocationRoot` already reconstructs owner-correct statement
FAST with a result-bearing `if`, mixed normal and return arms, and one following
return. `resultBlock` then tries to turn that body into a terminal value tree,
which cannot express the shared normal continuation.

Keep successful existing source profiles unchanged. When that terminal-value
reconstruction refuses this newly expressible statement profile:

1. Retain the structured body returned by
   [`directInvocationRoot`](../../../../from_fast/loop/root/module.f.mjs).
2. Preserve the existing conversion of synthesized inverse input/capture aliases
   to required definitions. Real lazy definitions keep their existing admission
   checks; moving or eagerly evaluating them is not this fix.
3. Initially admit required definitions, result-bearing statement conditionals,
   normal arm yields and owner-correct returns/throws. Keep unsupported transfers
   and value-region escapes explicitly refused.
4. Pass the body through the existing common preparation with `sourceLoops: true`
   and JavaScript renderer. They already emit initialized join slots, branch
   assignments and early returns; no new source syntax or EDAG operation is needed.
5. Keep `sourceReason` and existing graph, scope and source-layout checks. A
   failed terminal-value reconstruction must not become unconditional acceptance.

A read-only probe at the revision above produced source accepted by the current
parser, with identical checked identity analysis: 14 nodes and one function,
including the shared `g` call. Native execution matched all three paths and
selected failures. A blanket code-only preparation fallback also produced
JavaScript, but changed that analysis to 28 nodes and two functions; it is not
an identity-preserving replacement.

Extending `terminalTree` alone does not fix this example: it excludes
result-bearing decisions, and terminal-loop admission also requires an actual
continuation leaf. General sequential terminal-flow support and bounded-stack
retention of additional recursive profiles remain separate work below.

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

- [ ] Add the admitted nested-`if` example above as an end-to-end source-output
      regression through the public serializer, including source reparse.
- [ ] Retain the owner-correct reconstructed statement body for the initial
      normal/mixed conditional profile, preserving required inverse aliases and
      existing source admission checks.
- [ ] Verify all three paths, once-only `f`, a single shared `g` suffix, required
      field-read order, selected failures, branch scope, arity, graph identity and
      stable source round trips. Keep existing source, function-text and Rust
      output contracts unchanged.
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
- [Shared terminal fold](../../../../../js/ast/loop/terminal/module.f.js)
- [Common preparation](../../../../../js/ast/prepare/README.md)
