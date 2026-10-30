# Source loop output

The source coordinator retains loops that the admitted FunctionalScript grammar
can express and reconstructs other canonical invocation roots as recursive
functions. It consumes the normalized FAST chosen by
[EDAG output conversion](../../README.md); it does not repeat tail-call
eligibility, value placement, source-write analysis or mutable-state selection.
[Common preparation](../../../../js/ast/prepare/README.md) owns physical
slots, simultaneous transfers, immutable snapshots and invocation lifetimes.
The serializers render that prepared plan.

Source output is a partial API. Its domain is narrower than code-only
JavaScript/function text and Rust, which consume the general prepared loop.
This distinction does not restrict the admitted source loop grammar in the
[language specification](../../../../../spec/control-flow/loops/README.md).

## Source loop profiles

Existing canonical scalar loops keep their graph and established spelling.
Broader invocation roots retain loops through the following shared plans.
Earlier scalar, plain and branching plans take precedence, preserving their
existing output layouts.

| Plan | Admitted body and result |
| --- | --- |
| Plain loop | Required condition-prefix definitions, one terminal conditional, a define-only continuing arm and one computed normal result. Empty or multiple semantic inputs are supported. |
| Structured loop | At most one input, with transfers to the nearest active loop and no return or loop transfer escaping an emitted value region. Empty-input roots use this plan only without a break to their own target. |
| Result-block normalization | Required normal-arm definitions and terminal conditional result trees become one result value block, then pass the unchanged plain-loop checks. |
| Branching transition | A selected terminal tree supplies the complete next-input vector to the exact loop. Required work stays in its lexical branches. |
| Terminal tree | Required definitions and result-free decisions end in exact continuations, one-result breaks or explicit throws. There is at least one continuation; empty semantic inputs also require a normal-completion leaf. |

The broader result-block, branching and terminal plans apply to canonical
rest-free roots with zero or multiple fixed inputs and roots with observed
rest. An ordinary single-input root retains its established scalar or
structured plan. An observed rest binding adds one semantic input, independently
of the public fixed arity: rest-only roots use the scalar path and fixed-plus-rest
roots use the packed path. Both conditional orientations are supported.
For a validated base-first rest-only plain root, the shared orientation helper
negates the terminal test and swaps its arms without moving prefixes or changing
transfer identities.

For example, source serialization of this function retains bounded-stack
execution, including a call with `100000`:

```js
export default n => {
    let i = 0;
    let sum = 0;
    while (i < n) { sum = sum + i; i = i + 1; }
    return [i, sum];
};
```

The result is `[100000, 4999950000]`. Sequential and nested loops use the same
source state selection and shared conversion. A normally completing inner loop
resumes the enclosing body once, with fresh reached local declarations.
Conditional statements provide explicit FAST results for outer writes,
including preceding values retained by an unchanged arm.

Unlabeled `break` and `continue` retain their nearest loop target. A continue
retests the condition; a break supplies normal results before following work
resumes. Owning-function returns cross generated loop helpers, while ordinary
nested functions keep their own return owner. Statement throws preserve reached
work and bypass the normal continuation. Literal-true loops with their own
explicit exits omit an unreachable false-condition wrapper; no-exit loops keep
their established graph shape.

## Evaluation and result regions

The plain-loop plan evaluates its complete required condition prefix at every
test, including the final false test. Only primitive values, established
references and numeric projections needed by the continuing body or result
can be copied into those regions. Copies follow first body reads, with
prerequisites before their users. Calls and identity-creating work stay in
their owning region.

Required normal-arm work runs once after the final test. The source normalizer
places it in the break-result value block without introducing an invocation
boundary. Terminal result decisions retain their lexical branches, so only
selected calls, allocations and failures run. Common preparation establishes
immutable final-input snapshots before this work, preserving final closures,
shared base allocations and the final rest array without another rest slice.
Leading total aliases and constructors may be exposed in the enclosing
post-loop region to preserve required allocation order before later result
projections. Calls, lookups and selected regions remain placement barriers.

A branching transition establishes one selected scalar or packed vector after
its required branch work. Every reached argument finishes before state changes.
An empty-input transition yields `undefined` after its work to the existing
private unchanged slot; it adds no semantic argument or public parameter.

The terminal-tree plan instead keeps the original body in `while(true)`.
Required arrays, objects, closures and call results shared by a test,
continuation or result are established once in that visit, including the visit
that completes the loop. Multiple semantic inputs use one private array slot;
immutable body projections retain the values captured by that iteration.
A continuation establishes the complete next vector before the slot write.
A break establishes its selected scalar, writes that same slot and exits.
Rest-only roots use the existing shared scalar slot.

Empty-input terminal roots initialize only a private result slot to `undefined`.
Their semantic inputs and continuation vectors remain empty; required unused
arguments run before continuation without a state or result write. Completion
writes its selected result. Nonempty-input terminal trees may continue at every
leaf or mix continuation with throws, without fabricating normal completion.
A selected throw evaluates its required prefix and payload once, then exits
without a state or normal-result write. Earlier zero-input divergent and
throw/continue layouts retain their previous plans.

## Invocation lifetimes

The [shared invocation recipe](../../../../js/ast/invocation/module.f.js)
establishes all supplied arguments and spreads under the current invocation
before any state write. Missing fixed arguments become `undefined`; unused
extra arguments and failed expansions retain required evaluation. A complete
private argument vector supplies fixed projections and a fresh rest slice.
Empty and nonempty rest arrays are shared within one invocation and fresh
between iterations. Held closures retain their creating iteration's rest array
and immutable parameter snapshots, including after later public calls.

Lowered default and destructuring setup runs each iteration. Local allocations,
function constructions and memo storage retain their original invocation or
iteration lifetime. Public fixed arity and remaining self identity are preserved.
Only eligible direct self-call evaluations become transitions; indirect helper
calls and ordinary non-tail recursion retain their existing behavior. The
[tail-call eligibility contract](../../README.md#tail-call-eligibility)
defines that boundary.

## Source normalization

Logical conversion, source spelling and physical target layout have separate
contracts. The shared logical loop signatures do not acquire physical packing,
selector tags or new graph metadata. Default code-only JavaScript/function-text
and Rust layouts keep their established plans.

Parsing the first broader source output can introduce a scalar helper boundary
between iteration and normal-result computation, changing original graph bytes,
hashes and function text under the
[function-source exception](../../../../../spec/principles/README.md#function-source-representation-exception).
One-use missing/extra/spread argument setup can also inline on that parse.
The graph obtained from the first emitted source is the source-normalized
baseline. Its identity analysis and canonical text then remain exact on repeated
graph/source cycles; helpers, projection demands and private invocation wrappers
must not accumulate. Existing raw scalar fixtures retain their exact graph and
source contracts.

Construction can omit an ordered redundant anchor suffix already demanded by
the result. Discarded literal `undefined` anchors also normalize away: they
cannot fail or create identity. Used values, allocations, calls and other
required work retain their evaluation and sharing. Capture compaction,
canonical binding reads and pure lazy splitting remain subject to the
[general graph round-trip domain](../../README.md).

## Eligibility and fallback

The source coordinator first attempts the shared plans above. Other canonical
invocation roots use the graph owner's transfer resolver to reconstruct a
recursive function. Synthesized invocation-read aliases become required reads,
and terminal statement decisions return through source value conditionals.
A reifiable lazy definition retains its first-demand behavior in that recursive
source form.

Supplied profiles that cannot regain source grammar return
`a factored terminal continuation outside the source loop profile` through
`Result`. They must not assert, duplicate shared calls or emit unreadable source.
Source transfers to outer loop targets, returns escaping value regions, and
general lazy or structured prefixes remain bounded by their existing admission.
These are limits on supplied canonical FAST/EDAG output profiles, not additional
source-language refusals. Code-only JavaScript/function text and Rust retain
their wider common-preparation domain.

The remaining work is tracked in
[general source profiles](todo/general-source-profiles.md), including a demanded
lazy terminal prefix and a normally completing decision followed by one shared
continuation. Distinct duplicate calls written in source do not establish the
same graph-sharing case.

## Evidence

The [source-loop proofs](proof.f.mjs) retain exact first-parse graph/text checks,
source exits, nested and 18-state loops, required failures, rest and capture
lifetimes. `lazyTerminalPrefixesRetainTheirRecursiveSourceFallback`,
`unsupportedFactoredInvocationProfilesReturnReasons` and
`sourceLoopRetentionChecksLexicalTransferRegions` pin the fallback boundaries.
`explicitThrowRootsKeepFirstParseFixedPoints` and
`explicitThrowRootsKeepReachedFailuresAndNormalResults` cover selected throws
and mixed completion paths.

The [native serializer proofs](../../../../compiler/serializer/value/proof.mjs)
observe deep transfers, required evaluation order, held creating-iteration
captures, rest identity and public arity. Complete initial source spellings are
pinned by [compiler output proofs](../../../../compiler/proof.f.mjs).
Common preparation's [proofs](../../../../js/ast/prepare/proof.f.mjs) pin
physical state/result writes separately from logical graph conversion.
