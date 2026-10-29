# A function's text in the EDAG interpreters

Amnesia and memo retain function bodies and evaluated captures as `EdagValue`s.
Their shared [conversion](./value/convert/module.f.mjs) uses canonical code
rendered from the EDAG for explicit `String(f)` and indirect conversion through
arrays, object coercion, keys and built-in methods. Neither interpreter creates
host callables or overrides a host function's `toString`.

The trusted `functionText(analysis, index): string` entry in the
[serializer](../compiler/serializer/module.f.mjs) renders every admitted body
through EDAG → normalized FAST → common preparation → JavaScript syntax.
Source serialization, runtime-value output and Rust output share that
conversion and preparation; they select their own output form. `tryFunctionText`
checks separately supplied expressions and returns admission diagnostics through
`Result`. Captures appear as slot names, `$0`, `$1`, and so
on, without including their values. Two functions instantiated from the same
body therefore have the same text even when their captures differ.

All generated bindings use one `$n` counter per rendered document. External
frame slots receive the first numbers in capture-signature order, including
unused slots. Reversed body reads still use those positional names directly;
for example, a two-slot body may read `()=>[$1,$0]`. Declarations then receive
distinct numbers in text order, across all nested scopes. Fixed parameters
retain the function's arity; an unused rest binding need not be printed. Where
the source serializer cannot reconstruct a body, function text uses general
JavaScript expressions. Common preparation supplies invocation-local memo
cells for values shared between lazy regions and keeps iteration-local work
inside the loop. An unselected demand stays unevaluated, and a successful
initializer supplies the same established value to subsequent demands. The emitted JavaScript may use local mutation; the renderer itself
is immutable FJS. Amnesia still recomputes each edge when interpreting the body:
function text describes its code, independently of the chosen execution model.

This is code-only text, not a serialization of captured values, a FJS source
round trip or an implementation of callable runtime compilation. Source
serialization through `tryStringify` remains partial. Callable runtime
compilation uses [`value/to_unknown`](./value/to_unknown/module.f.mjs) and the
JavaScript value emitter. `compiler/transpiler.transpile` uses that boundary
for ordinary runtime exports; the
[value contract](./values.md#runtime-compilation) describes target support.

## Host runtime values

The [function-source exception](../../spec/principles/README.md#function-source-representation-exception)
allows ordinary JavaScript execution to retain its host's function text.
Converting an EDAG function to a runtime callable intentionally loses EDAG
reflection; that boundary remains subject to the host exception.

Before the EDAG-value migration, Amnesia and memo used the fixed arrow wrappers
in `fjs/types/function/length`. Their text was accepted as the host's in
[#2469](https://github.com/functionalscript/functionalscript/pull/2469).
Changing those closures with a `Proxy`, property mutation or a JavaScript import
was rejected in [#2418](https://github.com/functionalscript/functionalscript/pull/2418).
Keeping code as represented data removes that need. Both interpreters now
check canonical text, including the corpus's cases that the independent
JavaScript reference still skips because its function text is host-defined.

## Canonical spelling and migration

The common FAST output migration intentionally changes generated code bytes.
The former direct writers' parentheses, generated names, temporary declarations
and loop aliases are not retained as a separate text format. For example, a
code-only arithmetic body formerly written as `()=>((1)+(2))` is now
`()=>1+2`. The current spelling is deterministic for the admitted body and its
ordered capture signature, independently of the captured values. Repeated
conversion of the canonical graph stabilizes; this is not a promise that a
pre-migration graph keeps its bytes, hash or function text.

Text comparisons, keys and branches based on the generated string can therefore
change across this deliberate migration under the
[function-source exception](../../spec/principles/README.md#function-source-representation-exception).
Function arity, successful evaluation, required failures, captured allocation
identity and lazy sharing retain their existing contracts. Representative exact
spellings and host behavior are pinned by the
[function-text proofs](../compiler/serializer/function_text/proof.f.mjs) and the
[prepared JavaScript proofs](../js/ast/serializer/proof.mjs).

## Conditional representation of short-circuit expressions

Source `&&`, `||` and `??` now lower to conditionals before canonical EDAG
construction. The left operand is established once in its original evaluation
region, and each selected arm returns the original operand value. Code-only
text therefore uses conditional syntax; for example, a two-parameter `a && b`
body has the form `($0,$1)=>$0?$1:$0`. Nullish choice uses strict comparisons
with `null` and primitive `undefined`, preserving ordinary falsy values and
source name shadowing.

This is a deliberate graph-schema and function-text migration. Former EDAG
logical tags are rejected at checked graph boundaries; they are not retained
as an alternate serializer input. Source syntax remains supported. Newly
canonical graphs have their own structure and hash, and repeated conversions
stabilize without restoring logical tags or accumulating wrappers. Captured
identity, required left-operand work, skipped right-operand failures and exact
returned values retain their existing semantic contracts.

## A loop

The [shared conversion](./to_fast/README.md#tail-call-eligibility) preserves
the canonical scalar shape `r => COND ? self(NEXT) : r` as an explicit normalized
loop before JavaScript rendering. Common preparation chooses the private state slot and
immutable snapshots of the current iteration. The code-only spelling for a
counter to ten is:

```js
($0)=>{let $1=$0;while((()=>{const $2=$1;return $2<10;})()){const $3=$1;const $4=$3+1;$1=$4;}return $1;}
```

Required work and memo storage owned by an iteration remain inside it, so a
later iteration receives fresh values as a later recursive invocation did.
The state assignment is omitted when the next value is the current parameter;
the paired `let` and `while` remain. No self binding is needed for the
recognized loop. This runs a million rounds on V8 without requiring host tail
calls. Functions whose invocation or capture behavior requires ordinary
recursion keep their recursive representation; eligibility belongs to the
[shared conversion](./to_fast/README.md), rather than to an individual writer.

Shared conversion also lowers direct terminal self-call evaluations with zero
through sixteen fixed parameters, with or without observed rest. Either
conditional arm and the final sequence operand can transition; arbitrary base
results return directly. Each argument is established before simultaneous state
updates, and immutable iteration snapshots preserve escaped captures. Required
prefix work and local memo storage start afresh each round. Reading a previously
established recursive result does not invoke or transition again. Mixed ordinary
self uses retain a named function around the loop.

These general forms intentionally change code-only function text under the
function-source exception. Their JavaScript and Rust loops use bounded stack
for tail-only iterations. The source serializer retains its admitted scalar,
plain and structured loop profiles; other invocation roots retain their
recursive spelling or existing refusal. Each source profile has its declared
graph-normalization and round-trip domain. Missing fixed arguments become
`undefined`, and unused extra arguments retain their required evaluation before
the transition. This extension deliberately changes the text of these newly
eligible functions as well. Spread calls materialize their arguments before the
transition, including required expansion and unused extras. Rest transitions
create a fresh rest array per invocation while preserving sharing within it and
captured snapshots. Lowered default/destructuring setup runs each iteration.
The internal rest input does not change the function's public fixed arity.

A source call to such a function may retain a named callable whose own body
contains the loop. It need not be inlined into the caller's body. Source
functions with multiple captures establish aliases in signature order before
the condition, even when the condition reads a later capture first. Code-only
text instead reads its external positional slots directly. These forms share
loop preparation and preserve their respective source-round-trip and code-only
contracts; they need not have identical text.

The detailed [source loop profiles](./to_fast/source/loops/README.md) include
zero-input and observed-rest roots, required base work, branching transitions,
mixed normal/continuing decisions and explicit throws. Their physical scalar,
packed or private unchanged slots belong to source preparation. Source spelling
may introduce a scalar-helper boundary on the first parse, changing the graph
and its function text once under the exception. The graph from that first
source parse and its canonical text then stabilize exactly. The source profile
does not change the default JavaScript/function-text/Rust layout of the original
logical graph.

Source reconstruction preserves public fixed arity, required argument and
payload evaluation, fresh rest identity and held creating-iteration captures.
A selected throw leaves without a normal-result or state write. Existing
zero-input throw/continue and divergent layouts keep their earlier plans.
Other supplied canonical graph profiles retain their recursive source fallback
or explicit refusal; the [remaining source-profile work](./to_fast/source/loops/todo/general-source-profiles.md)
is separate from code-only function text's wider domain.

## A function that names itself

A body that reads `["self"]` has no arrow spelling, since an arrow function
cannot name itself. Its text is a named function expression,
`(function $0($1){…})`, with its self name allocated before its parameters.
Memo cells, their local temporaries, parameters and nested functions share the
counter, so none shadows another. The source writer can spell the same
function through an established binding, `const $0=()=>$0();`. Its capture
aliases and source form follow the source parser's separate round-trip
contract.
