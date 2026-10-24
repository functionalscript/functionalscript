# Normalized FAST to EDAG

`fromFast` constructs a graph from immutable value identities, required or lazy
definitions, result blocks and resolved transfers. Source legality, capture
admission and loop-state selection have already finished. A value block adds
no function or invocation boundary.

Functions own targeted returns. A block's normal result can have zero, one or
several values; one stays scalar and the other signatures use an ordered array.
Required definitions retain initializers that the result reaches only
conditionally or does not reach at all. A required root already established
through an eager dependency needs no separate comma operand. This decision uses
FAST binding identities, including for primitive initializers. Lazy definitions
retain required inner evaluations in their own expression and establish them
only when that value is reached. References reuse the established graph node;
equal operations written separately stay separate.

The source consumer is the admitted-source adapter in
[`js/ast/sugar`](../../js/ast/sugar/module.f.mjs). Source admission finishes
before graph construction. Physical prepared FAST is never an input to this API.

The baseline supports the established scalar loop: one parameter and result,
a condition, definitions followed by its continue, and an unchanged-state
break. It constructs the same one-argument recursive helper as the previous
source pipeline. Entry values and captures are established at the original
loop statement, including inside conditional regions. Unused loop results do
not discard the loop's required evaluation.

Other normal-exit loops use one recursive helper with an ordered state array.
The array slots follow the explicit loop parameter order, so state signatures
are not limited by the function fixed-parameter limit. Each continue packages
all next values before the recursive call. Each break returns an ordered result
array, including zero or one result; the caller projects the declared results
and resumes after the loop. Input and result signatures are independent.
Sequential loops, loops in either conditional region and nested normal-exit
loops retain their original entry point. A skipped region establishes neither
entry values nor captures. An inner loop gets a new helper entry each reached
outer iteration, returns its results to its caller, and the caller resumes its
own following work and transitions.
Only already-established free values may cross the helper boundary; a lazy
free binding is refused until shared demand-state transport is implemented.

[`loop`](./loop/module.f.mjs) builds these helpers as normalized single-input
invocation loops, then the existing root resolver and ordinary function
constructor produce their graphs. A helper's graph uses one array argument,
direct self calls with the next state array, and direct result arrays, without
completion tags. The loop call is shared by all result projections and remains
required even when no result is used. Aggregate state-slot reads are required
definitions at iteration entry, allowing inner helpers to capture established
outer values. Otherwise-unused slots retain required read anchors. These reads
use the already-evaluated internal state array and introduce no source
evaluation. This extends the aggregate-helper graph normalization from the
previous lazy slot reads; the state/result order and existing scalar exact-graph
cases remain unchanged. General helper round trips preserve their documented
sharing normalization and repeated conversions stabilize.

[`loop/completions`](./loop/completions/module.f.mjs) carries statement-level
returns and outer-loop transfers through helpers. Only nonroot loops with
escaping control gain a private completion result: `["normal", resultValues]`,
`["return", value]`, `["break", targetId, resultValues]`, or
`["continue", targetId, nextValues]`. The completion occupies one loop-result
slot, carried by the existing aggregate helper result array. Normal completion
binds the original results and resumes; return completion exits the owning
source function. An outer-loop transfer returns to callers until its target
owner performs its own break or continue. Intermediate helpers never invoke an
enclosing helper. Arrays with the same shape supplied as source values remain
payloads.

Target IDs follow lexical loop introduction order over resolved identities in
each function or standalone/local block normalization scope. Values and ordinary
nested functions are opaque to that inventory. Equal debug indices remain
distinct, and only actual lexical ancestors can receive transfer completions.
Caller dispatch reads the target's original result/parameter signature before
helper packing or completion wrapping; all next values are established before
the target's state changes. Original result bindings are declared once by the
outer dispatch, with additional cases in zero-result statement regions.

`completeTransfers` traverses a source function's statement regions before
helper construction. `completeBlockTransfers` handles standalone blocks without
inventing a source-function owner. Operand blocks normalize their own local
loops on entry; transfers to targets outside that operand remain refused.
Already-normalized statement regions skip a repeated pass. Changed
nonroot function bodies use the shared terminal statement resolver to turn
early-return dispatch into ordinary conditional results. Normal-only helpers
retain their previous graph path. Canonical invocation roots are exempt from
completion wrapping, so terminal public results and self calls stay direct;
their inner helpers can still return to the owning source function. Return
payload computations remain ordinary evaluations; broader tail-call eligibility
belongs to milestone F. Throws and failures use the existing failure channel.

A canonical scalar invocation loop reuses its enclosing function. Its body
contains only aliases of established arguments, captures or self before the
loop, then a direct return of the loop's single result. Capture and self aliases
cannot replace the current argument at the loop entry. Its arity is one, it reads no rest
array, and the loop enters with that current argument. Reuse keeps the same
frame and self identity. One-time setup, a different invocation layout or
following result processing retains a separate helper.

The next supported root domain generalizes the fixed invocation signature:
zero through sixteen fixed parameters, no rest binding, and one opaque public
result. [`loop/root`](./loop/root/module.f.mjs) checks that each loop entry
aliases the corresponding current argument and the function directly returns
that loop's one result. The shared invocation-alias inventory also admits
prefix references to already established captures and self values. Those
references introduce no computation or identity; they do not qualify as loop
entry arguments. Computations, allocations and unestablished lazy values
remain outside the root prefix. Binding and
target object identities determine correspondence; presentation indices do not.
The existing scalar reconstruction takes priority and retains its exact shape.
The body reads invocation inputs through loop iteration bindings. A free read of
an original function parameter or its transitive prefix alias prevents reuse:
self calls would otherwise replace that retained entry value. Both scalar and
general root matching use the same scoped dependency check. Existing scalar
helpers preserve supported retained values through captures; other forms refuse.

Within a matched general root, an owning `continue` constructs a direct self
call with all next values evaluated in the current invocation. An owning
`break` or function `return` supplies the public value directly. Targeted
statement blocks and conditionals resolve those transfers through the same
ordinary graph constructor. Ordinary regions retain their original values and
sharing. No completion/state envelope surrounds a tail call or public result;
an existing helper's argument and returned arrays remain opaque values.
Captures, retained self values, required work and observable arity keep their
ordinary function contracts. This extends internal reconstruction; source
admission and broader tail-call recognition remain their later milestones.

The direct graph round-trip domain uses canonical binding reads: one node per
argument, frame slot, rest or self binding in each scope, with explicit shared
value definitions and canonical required anchors. Literal undefined nodes use
one fresh occurrence per literal position; arbitrary sharing of the tagged
primitive is outside this exact graph domain. Function captures are
canonical too: every slot is used, nonprimitive and distinct under the existing
binding-read alias rule. Within the supported scalar and fixed-invocation
root forms, reconstruction preserves the direct recursive graph, including its
sharing; it does not add a helper wrapper. Distinct identity-producing
expressions remain distinct. Tests compare identity-analysis tables for this
domain. Graphs with distinct identity-free reads of the same binding normalize
those reads to the common binding node. Primitive and equivalent duplicate
captures normalize through the existing capture compaction, yielding a new graph
identity whose repeated conversions stabilize. Unused nonprimitive slots remain
present and eager in explicit normalized functions, including a failing slot;
their layouts are outside the named exact source-roundtrip domain. The source
adapter's filtering of unused AST capture metadata is a separate existing source
contract. Existing source round trips retain
their analysis-normalized comparison, including the documented lazy-region
splits and redundant-anchor normalization.

These increments do not complete epic E. Nonlocal exits across value operands,
rest invocation reconstruction and lazy demand state crossing a generated
helper boundary remain explicit E/F work. Unsupported forms are refused
explicitly. Foreign or nonlexical loop targets remain refused, as do foreign
function-return targets and loop-body normal yields. Standalone block
construction has no source function to own helper returns. A true lazy free
binding is not eagerly captured by either helper constructor. The
[loop construction proposal](../todo/fast-loop-construction.md) records the
completion and memo-state contracts for that extension.
