# EDAG output conversion

The output pipeline is `identityAnalysis` / checked admission → `fromAnalysis`
(normalized FAST) → common FAST preparation → a target serializer. Runtime
value output, code-only function text and Rust output use this same conversion.
Serializers receive prepared instructions and allocate lexical names; they do
not inspect EDAG reachability, choose value owners or reconstruct recursion.
`fromAnalysis` accepts a trusted table, including explicit fragment bindings;
`toFast` is the checked graph boundary. Canonical graphs contain conditionals
rather than logical/nullish tags. Source `&&`, `||` and `??` are lowered by
AST-to-FAST sugar before graph construction; old tagged graphs are rejected at
checked admission. Output conversion does not carry a compatibility rewrite or
a second logical-lowering algorithm.

Graph conversion assumes the canonical `Exp` shapes. `checked` admits invocation
bindings and scopes; it does not replace the EDAG shape schema. In particular,
a plain `.` continuation starts with a terminal `|()` or an optional `|?.()`.
An ordinary path such as `base.x.y(args)` uses nested `.` nodes, so its final
call's arguments are eager operands. A `|.` continuation is legal only inside
an optional region, for example `base?.x.y(args)` or `base.x?.().y(args)`; its
later keys and calls remain inside that region. See the
[chain grammar](../README.md#which-step-is-legal-where). Extending the traversal
to accept `|.` directly after a plain `.` would admit a second graph spelling
which the canonical schema and source parser exclude.

Required definitions remain in the execution region that establishes them.
Captures establish their values before closure construction, including unused
nonprimitive captures. Shared allocations and calls reached only through lazy
regions have one lazy definition in their common region. Preparation gives that
definition invocation-local memo storage, demanded on its first executed read.
A failed initializer does not mark its storage complete. A loop recreates its
iteration-local definitions and capture snapshots each iteration.

An enclosing binding already owns its established callee or capture value.
Nested regions read that binding instead of declaring the same nominal identity
again. Explicit comma demands retain their evaluation through a fresh discarded
binder where needed. This keeps generated declarations valid and preserves the
captured allocation's identity.

An unshared callee or capture that needs a name inside a later operand gets a
local value block at that operand. Its initializer stays after earlier calls,
coercions and implicit lookup or spread work. Region roots, established owners
and function values whose captures are already established retain their prefix
names.

Sharing entirely within one operand stays in that operand's region, including
computed member keys in the normalized operand vocabulary. A shared value used
across operands becomes required only after its earlier eager work has been
established. Complete earlier computations receive ordered immutable snapshots;
implicit spread expansion, key conversion and member lookup remain barriers.
A later snapshot cannot claim a dependency reachable from an earlier planned
initializer. That earlier initializer may already have demanded the value;
rewriting its lazy dependencies to the later binding would read an uninitialized
snapshot. Those dependencies retain their existing owners instead.
A value that cannot cross such a barrier safely retains first-demand memo
storage. Source admission explicitly refuses that storage where its grammar
cannot express it; runtime JavaScript and Rust consume the common plan.

Explicit comma roots retain their written order. Required definitions and memo
declarations follow their dependencies rather than using graph indices as a
global execution order. Total container and function constructions over already
established operands can keep their prefix names. The shared
[`demandsInOrder`](../demand/module.f.mjs) query proves each placement against
the actual established values. Graph construction uses the same query to remove
only ordered redundant anchors.

A value shared across otherwise separate lazy regions may instead be repeated
when every operation reachable from it is `mergeable` and none is a comma.
This transitive check stops at values already established eagerly or by an
outer binding. Thus an eagerly established array can have its pure length read
repeated in separate branches, while an array allocation, function allocation,
helper function, call or sequence confined to those branches keeps one lazy
owner. This is the existing source writer's pure lazy normalization, now chosen
once for all targets. It can split graph nodes; it preserves evaluation and
allocation identity at the established bindings.

A successful tail plan can subsequently establish inert invocation-prefix
allocations as required bindings, as described below. This preserves their
observable identity and evaluation behavior but can add required graph anchors;
it does not extend the raw graph/hash round-trip domain.

The exact graph round-trip domain uses canonical capture layouts and canonical
binding reads. FAST references use binding object identity, and `fromFast`
constructs one `arg`, `rest`, `frame` or `self` read node per binding identity.
Graphs with separate equal read nodes therefore acquire canonical sharing and
can change graph bytes and hashes. A tagged undefined primitive becomes a fresh
literal occurrence at each use; arbitrary sharing of that identity-free tag is
also outside the raw graph domain. Primitive captures and equivalent duplicate
capture values can be compacted by canonical graph construction. Unused
nonprimitive capture inputs remain eager and are preserved. Source output
supports used primitive captures, including tagged undefined and repeated
primitive values. A capture factory establishes these values before returning
the closure. Its function-local self binding preserves recursive identity;
large capture signatures use one private array argument within the source
fixed-parameter limit. Unused slots and repeated nonprimitive slots retain
their existing admission limits.

A captured sequence can therefore become a primitive frame on source parsing
and still be written again. Required sequence work remains in its established
region even when the result becomes a literal. The primitive-capture profile
preserves values, selected failures, capture lifetimes and allocation sharing
through repeated source writes; it adds no general graph/hash identity or
graph/text fixed-point contract. These cases, redundant comma anchors and the
pure lazy splitting above are excluded from a claim of raw graph identity.
Existing canonical and normalized domains retain their documented graph/text
stabilization contracts.

## Tail-call eligibility

Eligible scalar tail recursion becomes a normalized loop with one parameter and
one result. The function initializes the loop from its fixed parameter and
returns the loop result. Its condition and transition regions are explicit;
common preparation chooses loop slots and immutable iteration snapshots.
Functions that require ordinary recursive identity retain their self binding.
The baseline preparation domain and its explicit deferred control-flow cases
are described in [`js/ast/prepare`](../../js/ast/prepare/README.md).

General tail lowering follows value placement. Tail position belongs to an
evaluation and its use, not globally to an EDAG node:

| Returned form | Candidate evaluation |
| --- | --- |
| Direct call of the current invocation's resolved self | That call. |
| Conditional | Its selected result arm, not its test. |
| Sequence/comma | Its final operand, after earlier required work. |
| Other expression | No candidate established by these rules. |

Do not identify self by a printed name or cross into an ordinary nested
function's body. For example, `const r=f(n-1);return r===0?r:1` requires the
call before its condition; the later reads of `r` cannot become transitions. A reference to an established call result stays a read;
required definitions and nonterminal lazy demands keep their evaluation owners. Nested
function bodies have their own plans. Function bodies are planned once in graph
postorder, and naming and emission consume the same private plan.

A lazy recipe used only at terminal leaves can follow their decision tree once.
Its selected leaves become normal zero-result joins; other leaves finish their
invocation before reaching the recipe. Required calls and allocations in that
recipe retain their original identities and order. Exclusive terminal lazy
dependencies move with the recipe and factor recursively, including direct
aliases. A terminal base recipe produces a one-pass loop with no backedge.
Tests, ordinary operands, required aliases and captures keep their demands.
Independent exclusively terminal recipes use one result-bearing selection
region followed by one continuation per recipe. The original decision tree
yields a private recipe index; reached base results and abrupt exits finish
their invocation directly. Dispatch evaluates the selected recipe once through
the existing invocation transition. Required prefix definitions and shared
nonexclusive dependencies remain outside the selection region, visible to both
selection and continuation; exclusive dependencies stay with their recipe.
The [shared fixtures](tail/fixtures.f.js) cover interleaved calls, distinct
argument vectors, selected failures and creating-invocation captures.
After a successful tail-loop plan, inert prefix definitions over invocation
inputs and earlier established prefix values become required immutable
bindings at their existing declaration positions. Arrays without spreads,
objects with literal keys and closures with established captures can retain
one invocation's allocation without memo storage. Calls, lookups, coercions,
spreads and unknown outer deferred reads keep their demand owners. The
normalization belongs to the planned invocation body; ordinary module-root
lazy placement keeps its existing contract.
The common join walk also removes a sole conditional's exact result-forwarding
wrapper using shared [normal-result forwarding](../../js/ast/results/README.md).
Its test and arms retain their scopes and transfer owners. Source coordination
reuses the same rewrite before checking its existing loop profiles.

After tail-control placement, [`join`](join/module.f.mjs) recovers normal
statement results selected by the same established test. A residual value, or
shared selected recipe first demanded by following work, becomes an explicit
result of that statement conditional. Terminal arms keep their transfers and
the following continuation remains one computation. The same recovery handles
a conditional value first demanded by an immediately following required
initializer. The ordered-demand and scope checks keep earlier work and
branch results in place; a decision that rebinds its own test cannot establish
the later condition's value. Moved arms and recipes retain their original
lexical dependencies, including deferred captures. Each normal arm yields an
immutable joined value.
A deferred recipe used only within one resulting arm becomes required at its
first proven demand; the shared graph demand query checks calls, lookups,
spreads and lazy barriers.
Earlier work and recipes with other uses keep their original evaluation owner.
Demand checks expand visible deferred initializer graphs without evaluating them,
so transitive closure captures retain their first-read order. Ordinary function
bodies remain opaque. A closure first demanded after the control join is
constructed there once, with the selected immutable capture values.
Deferred declarations depending on a recovered result follow its conditional
in their original dependency order; their evaluation still waits for first use.
Only newly recovered results can change where those declarations belong.
First-demand recovery can descend through a definition's first referencing
statement conditional when only one arm uses it and the test and following
continuation do not. Later dependent definitions are considered first, so their
prerequisites retain their declaration order. Each move preserves both its
initializer's dependencies and its own binding identity across intervening
declarations. The existing ordered-demand proof chooses the executed use;
deferred declarations, ordinary function bodies and loop boundaries do not
authorize moving evaluation.

## Invocation construction

The general domain has zero through sixteen fixed parameters, with or without
an observed rest binding. Its canonical root
loop returns one opaque public result. Entry bindings and iteration bindings
are distinct identities. Common preparation establishes all next arguments
before slot writes and snapshots current parameters for captures, while local
objects, functions and memo storage are recreated each iteration. Remaining
non-tail calls and self references retain the function's recursive identity.
Missing fixed arguments become `undefined`. Supplied arguments are established
before state changes, including unused extra arguments and their failures.
Calls with spreads or extra arguments use one required private array, followed
by reads of its fixed prefix. Common preparation retains reached expansion and
its failures before state updates, even when the fixed prefix is empty or
already full. This retains lazy demands and capture reads
without creating discarded reference anchors that move on a later graph conversion.
The array's identity stays private to the transition.
Observed rest adds one internal loop input, independently of public arity.
Entry rest and iteration rest have separate binding identities. Each rest
transition uses the shared [`invocation`](../../js/ast/invocation/module.f.js)
recipe: establish the full argument vector, then read the fixed prefix and
create its fresh rest slice before simultaneous updates. Repeated reads within
one iteration share that slice; escaped captures retain the creating iteration's
array. The whole placed body runs inside the loop, including lowered default
and destructuring setup. Remaining ordinary self uses keep their function owner.
Existing scalar graph cases keep their previous shape; general cases
retain their normalized graph on repeated conversion. For
`f=(n,saved)=>n===0?saved:f(n-1,()=>n)`, the result of `f(2,null)()` remains `1`:
the closure holds its creating iteration's value, not the final mutable slot.

Lowering missing, extra or spread arguments deliberately changes the graph to
fixed invocation inputs. Source output preserves evaluation and remains parseable;
parsing its first output can inline one-use argument setup. Serializing the
normalized graph gives that canonical source spelling, which is stable on
subsequent source round trips. Existing exact-graph/source fixtures retain
their contracts.

## Source spelling

General loops retain the required function owner chosen for their recursive
form, even when runtime self reads become transitions. This preserves placement
and supplies the name needed by a recursive source fallback. Code-only
JavaScript and Rust consume the common prepared loop. Source output retains the
admitted scalar, plain, structured and terminal profiles through the
[source loop coordinator](source/loops/README.md#source-loop-profiles).

That coordinator applies shared recognition and preparation to zero-input,
fixed multi-input and observed-rest invocation roots. Required result work,
branching transitions, mixed completion/continuation and explicit throws keep
exact transfer targets, lexical regions and invocation lifetimes. A physical
packed state/result slot does not add logical graph metadata or public
parameters. Existing scalar layouts and default code-only JavaScript/Rust
layouts retain their contracts.

The [source normalization contract](source/loops/README.md#source-normalization)
defines the first-parse scalar-helper boundary and subsequent exact graph/text
cycles. Raw graphs outside that domain can change bytes and hashes once.
Reifiable profiles outside the source plans keep recursive spelling; other
supplied factored profiles return an explicit `Result` error. Their remaining
work is tracked under [general source profiles](source/loops/todo/general-source-profiles.md).

[`source`](source/module.f.mjs) is a separate source-spelling admission pass.
It retains the parser's representability restrictions and consumes the common
conversion's chosen definitions. It performs no second placement algorithm.
Operand-local commas have a value-block/IIFE spelling. Common placement can
establish shared sequences as ordinary bindings, which source admission now
accepts. Required work and repeated reads retain the same placement; remaining
genuine lazy FAST definitions still require unsupported memo storage and are
refused. Existing unshared-operand profiles retain their first-parse anchor and
capture normalization and subsequent exact cycles. Shared-sequence admission
adds no general graph/hash or fixed-point guarantee and no source syntax.
Canonical JavaScript bytes now come from prepared FAST, so names, grouping and
single-use temporary declarations may differ from the former direct graph
writers. Code-only function text still treats frame slots as external values
in signature order, without evaluating their initializers.
