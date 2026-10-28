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

The exact graph round-trip domain uses canonical capture layouts and canonical
binding reads. FAST references use binding object identity, and `fromFast`
constructs one `arg`, `rest`, `frame` or `self` read node per binding identity.
Graphs with separate equal read nodes therefore acquire canonical sharing and
can change graph bytes and hashes. A tagged undefined primitive becomes a fresh
literal occurrence at each use; arbitrary sharing of that identity-free tag is
also outside the raw graph domain. Primitive captures and equivalent duplicate
capture values can be compacted by canonical graph construction. Unused
nonprimitive capture inputs remain eager and are preserved. Source output
continues to refuse unused, primitive and duplicate frame layouts. These cases,
redundant comma anchors and the pure lazy splitting above are excluded from a
claim of raw graph identity. Their normalized graph and output text stabilize
on subsequent conversions; their established values, failures and sharing are
retained.

Eligible scalar tail recursion becomes a normalized loop with one parameter and
one result. The function initializes the loop from its fixed parameter and
returns the loop result. Its condition and transition regions are explicit;
common preparation chooses loop slots and immutable iteration snapshots.
Functions that require ordinary recursive identity retain their self binding.
The baseline preparation domain and its explicit deferred control-flow cases
are described in [`js/ast/prepare`](../../js/ast/prepare/README.md).

General tail lowering follows value placement. A direct self-call evaluated at
the returned result, either conditional arm or the final sequence operand can
become a transition. A reference to an established call result stays a read;
required definitions and nonterminal lazy demands keep their evaluation owners. Nested
function bodies have their own plans. Function bodies are planned once in graph
postorder, and naming and emission consume the same private plan.

A lazy recipe used only at terminal leaves can follow their decision tree once.
Its selected leaves become normal zero-result joins; other leaves finish their
invocation before reaching the recipe. Required calls and allocations in that
recipe retain their original identities and order. Exclusive terminal lazy
dependencies move with the recipe and factor recursively, including direct
aliases. A terminal base recipe produces a one-pass loop with no backedge.
Tests, ordinary operands, required aliases and captures keep their demands;
independent interleaved recipes retain their existing recursive layout.

After tail-control placement, [`join`](join/module.f.mjs) recovers normal
statement results selected by the same established test. A residual value, or
shared selected recipe first demanded by following work, becomes an explicit
result of that statement conditional. Terminal arms keep their transfers and
the following continuation remains one computation. A deferred recipe used
only within one resulting arm becomes required at its first proven demand;
the shared graph demand query checks calls, lookups, spreads and lazy barriers.
Earlier work and recipes with other uses keep their original evaluation owner.
Demand checks expand visible deferred initializer graphs without evaluating them,
so transitive closure captures retain their first-read order. Ordinary function
bodies remain opaque. A closure first demanded after the control join is
constructed there once, with the selected immutable capture values.
Deferred declarations depending on a recovered result follow its conditional
in their original dependency order; their evaluation still waits for first use.

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
transition uses the shared [`invocation`](../../js/ast/invocation/module.f.mjs)
recipe: establish the full argument vector, then read the fixed prefix and
create its fresh rest slice before simultaneous updates. Repeated reads within
one iteration share that slice; escaped captures retain the creating iteration's
array. The whole placed body runs inside the loop, including lowered default
and destructuring setup. Remaining ordinary self uses keep their function owner.
Existing scalar graph cases keep their previous shape; general cases
retain their normalized graph on repeated conversion.

Lowering missing, extra or spread arguments deliberately changes the graph to
fixed invocation inputs. Source output preserves evaluation and remains parseable;
parsing its first output can inline one-use argument setup. Serializing the
normalized graph gives that canonical source spelling, which is stable on
subsequent source round trips. Existing exact-graph/source fixtures retain
their contracts.

New general loops retain the required function owner previously chosen for
their recursive form, even when all runtime self reads become transitions.
This preserves placement and supplies the name needed for recursive source
spelling. Code-only JavaScript and Rust use the common prepared loop. Source
spelling retains rest-free roots recognized by the shared scalar or
[`plain-loop plan`](../../js/ast/loop/plain/module.f.mjs), including aggregate
helpers produced by plain source loops. Rest-free zero-input roots also retain
their loop when no break targets that root. Shared preparation needs no result
storage for these divergent or throwing paths and emits the unreachable return
required by source grammar. Their first source parse introduces an aggregate
helper; subsequent graph/text cycles stabilize. Normally completing zero-input
roots keep their recursive fallback until independent result storage can meet
that same normalization contract. Other canonical roots use the graph
owner's existing transfer resolver. Synthesized invocation-read aliases become
ordinary required reads, and terminal statement conditionals return through
source value conditionals. Computed lazy definitions keep their existing
admission rules. The established scalar source loop remains unchanged.
The source adapter returns a `Result`: factored continuations outside its
one-input/one-result profile are refused when their normal guards cannot be
restored to recursive source. Such supplied zero-input, multi-input or observed
rest profiles retain bounded-stack code-only JavaScript and Rust; existing
reifiable recursive source profiles keep their spelling.

General plain-loop output computes the normal result after iteration. Parsing
the first emitted source introduces that scalar-loop/result boundary and can
change the original graph. The source-normalized graph and canonical spelling
then stabilize; repeated output adds no helpers or unused projection demands.
Copied condition projections follow their first body reads, with dependencies
before users. Construction may omit a required anchor suffix that the result
already demands after the retained prefix has executed. This can change initial
graph bytes/hashes and first-emission temporaries, including an arithmetic
state update that now appears directly in the next-state array. The
source-normalized graph and canonical spelling retain their exact fixed-point
contract; established raw scalar fixtures remain unchanged.

[`source`](source/module.f.mjs) is a separate source-spelling admission pass.
It retains the parser's representability restrictions and consumes the common
conversion's chosen definitions. It performs no second placement algorithm.
Unshared operand-local commas have a value-block/IIFE spelling. Their first
source parse can relocate safe anchors or compact equivalent capture slots;
the resulting graph and source spelling then stabilize exactly. Shared commas
outside canonical scopes remain refused. This extends source graph admission
without adding source syntax.
Canonical JavaScript bytes now come from prepared FAST, so names, grouping and
single-use temporary declarations may differ from the former direct graph
writers. Code-only function text still treats frame slots as external values
in signature order, without evaluating their initializers.
