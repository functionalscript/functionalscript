# Normalized FAST to EDAG

`fromFast` constructs a graph from immutable value identities, required or lazy
definitions, result blocks and resolved transfers. Source legality, capture
admission and loop-state selection have already finished. A value block adds
no function or invocation boundary.

Graph construction, invocation-root reconstruction and memo normalization share
the shared FAST [`task`](../../js/ast/task/module.f.js) evaluator. Deferred calls and result
continuations use its explicit stack, keeping deeply nested syntax off the
host stack without duplicating the evaluator in each pass.

Functions own targeted returns. A block's normal result can have zero, one or
several values; one stays scalar and the other signatures use an ordered array.
Required definitions retain initializers that the result reaches only
conditionally or does not reach at all. A required root already established
through an eager dependency needs no separate comma operand. This decision uses
FAST binding identities, including for primitive initializers. Lazy definitions
retain required inner evaluations in their own expression and establish them
only when that value is reached. References reuse the established graph node;
equal operations written separately stay separate.

A literal undefined root is total and creates no identity. Discarded
`['undefined']` required anchors therefore normalize away; a returned or used
undefined value stays in place. This removes no work from an enclosing comma,
conditional or other initializer. Their required children keep their original
order, as do allocations, calls and failures. Source output can seed physical
branch-result slots with undefined without accumulating a discarded literal
declaration on every parse. Removing these redundant literal anchors changes
the graph identity of inputs containing them; those inputs normalize before
the exact required-anchor round-trip domain applies.

## Required evaluation and graph normalization

Required initializers and loop calls also retain their order when their values
are reached only by a later export or result. A possible failure stays before
later divergent work, and earlier divergent work stays before a later failure.
Explicit throws retain their first failure payload as well.
Natural earlier demands need no duplicate anchor. Demand analysis distinguishes
reads before any failure from reads before divergence or an explicit throw,
including lazy recipes, spread expansion, computed keys and user-defined numeric
or string coercions.
Environment graph substitutions can perform work; ordinary function parameters
and captures are established values when the function body begins.

Construction retains the shortest required prefix in its original order whose
remaining suffix the result demands before intervening unowned work. The demand
proof treats the retained prefix as established and matches the same graph-node
identities, preserving earlier failures and lazy boundaries. Unknown operations
retain unproven anchors; the proof covers the complete removed suffix.
Before this final cut, a required root absorbs the contiguous preceding roots
that its own ordered first demand proves redundant. Earlier retained roots are
already established for that proof. For example, a required array followed by
a required member read of that exact array needs only the member anchor; if the
result in turn demands that member first, neither anchor remains. Noncontiguous
roots, intervening work and lazy or invocation boundaries keep their order.
This is the same redundant-anchor graph normalization, and prevents explicit
branch-result packing from alternating between two equivalent comma layouts.
Control-flow arms inherit the completed test and its required prefix for this
proof, including eager dependencies already evaluated by that test. Nested
arms retain these guarantees. Deferred definitions, arbitrary environment
substitutions and new function invocations acquire no such guarantee.
Within a selected arm, the demand query can follow that exact test's known
conditional outcome. This proves a subsequent demand; it does not pretend the
selected operand has already run. Other lazy operations and merely equal tests
retain their boundaries. Repeated tests retain one context entry per identity.

Normal-result joins inherit only tests completed on every normal predecessor.
Terminal predecessors supply no normal value, rather than a placeholder that
adds a redundant guarded result. Required prefixes still execute in the actual
control tree before following work. The following graph is lowered once and
retains that identity in each normal arm, including shared calls and arrays.
The shared demand query carries the retained prefix's eager dependency closure
forward as the cut advances, using the existing persistent identity set. Each
failed trial keeps its newly matched values local, so it cannot make a later
cut appear safe. Earlier dependencies are not rebuilt for every candidate.

Eager operands retain their own required evaluations when floating them would
cross earlier work. Construction tests the actual parent with each child's
anchors in place; only a proven ordered demand prefix permits those anchors to
float outward. Otherwise an operand-local comma preserves its execution point,
including after spread expansion, object-key conversion and member lookup.
Function captures and multiple yielded results use the same rule. A direct
member callee retains its receiver; a wrapped member value remains detached.
Established loop helper values follow the same call-operand boundary.

Source output now admits unshared operand-local commas through ordinary value
blocks and IIFEs. This newly admitted graph domain can normalize on its first
source parse: safe declaration anchors can move to an enclosing scope, and
equivalent capture slots can compact. Its source-normalized graph and text must
then remain exact on subsequent rounds. Existing admitted-domain identity and
source fixed-point proofs retain their original contracts. Shared commas outside
canonical scopes retain their explicit source refusal; linked shared-module
sequences remain in their [separate task](../../compiler/serializer/todo/shared-linked-comma.md).

Required-order anchors extend graph normalization. Memo metadata and completion
graphs can gain explicit demands when placement exposes a formerly implicit
ordering constraint. These fixtures normalize with two placement/construction
round trips from initial lowering, then require strict graph identity on the
next conversion. Their values, captures and identities are checked throughout;
their initial graph bytes/hashes are outside the canonical-anchor domain below.
Admitted-source fixed points and established scalar source spelling retain
their existing contracts.

The source consumer is the admitted-source adapter in
[`js/ast/sugar`](../../js/ast/sugar/module.f.mjs). Source admission finishes
before graph construction. Physical prepared FAST is never an input to this API.

## Helper construction

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
Already-established free values cross the helper boundary as ordinary captures.
Caller-owned lazy values use the normal-exit memo transport described below.

[`loop`](./loop/module.f.mjs) builds these helpers as normalized single-input
invocation loops, then the existing root resolver and ordinary function
constructor produce their graphs. A helper's graph uses one array argument,
direct self calls with the next state array, and direct result arrays, without
completion tags. The loop call is shared by all result projections and remains
required even when no result is used. Aggregate state-slot reads are required
definitions at iteration entry, allowing inner helpers to capture established
outer values. Otherwise-unused slots retain required read anchors. These reads
use the already-evaluated internal state array and introduce no source
evaluation. Required-order comma anchors extend the aggregate-helper graph
normalization; state/result order and established scalar emitted source remain
unchanged. General helper round trips preserve their documented
sharing normalization and repeated conversions stabilize.

## Shared lazy demand state

[`loop/memo`](./loop/memo/module.f.mjs) preserves lazy identity
across normal-exit helpers. Its lexical inventory selects deferred recipes used
free by loops throughout the owner's eager statement and value regions; direct
lazy reference aliases share the original cell. Selection also inspects deferred
initializers: a helper crossing there selects its owning recipe and connected
caller cells even without an eager caller loop. This analysis uses declaration
scope without evaluating either initializer, and ordinary function bodies stay
opaque. Cells follow definition order, independently of debug indices or demand
order. Primitive definitions and reads of established bindings keep their
existing classification.

Each internal cell contains an initialized flag and a value. A demand either
reads the ready value or evaluates the original recipe and returns an updated
memo vector. Conditional regions return only the selected arm's updates.
Following iterations, sequential helpers and caller reads reuse that vector;
another owning invocation starts with fresh cells. A skipped demand does not
evaluate the recipe, including when the loop takes zero iterations. Failure
uses the existing failure channel and produces no ready cell.

Each selected lazy declaration defines one private recipe function. It captures
established prerequisites at that declaration, accepts the current memo vector,
and returns the payload with its ready cell. This keeps the initializer's
lexical values when a later declaration reuses a binding identity. Only the
exact selected declaration activates a cell alias; earlier Environment reads
keep their original value. Required definitions, loop parameters/results and
statement results establish their own bindings, and child aliases do not leak
into the parent scope. Planning gives each statement-region occurrence its own
declaration and loop objects while preserving binding and target identities.
Reusing an immutable declaration, block or loop at two lexical positions thus
keeps their cells separate. Eager values share their owner's inventory;
ordinary function bodies and deferred initializers normalize separately.
Blocks without memo crossings return unchanged.

Occurrence preparation stops after a statement region with no normal path.
Its unreachable suffix and exit do not contribute memo dependencies or transfer
admission checks. Both conditional arms remain represented; a normal arm keeps
the following statements reachable, without evaluating constant conditions.

This extends the memo-bearing graph normalization with one recipe function per
cell. Public arity, source values and graphs without memo crossings retain their
contracts. The constructor supplies effective external lazy identities before
recipe captures are built; unavailable recipes and their lazy aliases remain
refused. Required aliases establish their values normally. A separate list of
lazy scope entries avoids scanning established bindings at each value region.

The pass replaces a selected loop with a fresh private loop whose inputs are
the user-state array and memo vector and whose results are the user-result
array and updated memo vector. Required projections establish the original
parameter/result bindings. Own continues and breaks package the user values
and memo state together. Original loop signatures, public function arity and
source results stay unchanged. The existing aggregate helper constructs the
private loop; no runtime cell mutation or new AST schema is needed.

Caller-owned recipes may depend on other caller-owned lazy values. The cell
inventory closes over both prerequisites and computed dependents, keeping
definition order. A demand follows only the dependencies selected by the recipe;
the new ready cell is installed in the recipe's returned vector, preserving all
dependency updates. Later helper/caller reads reuse the same established values.

A recipe function's captures contain established prerequisites and earlier
recipe functions; creating it does not evaluate a lazy payload. A miss invokes
that shared recipe, while a hit returns the stored value and incoming vector.
This avoids repeated expansion of conditional dependency diamonds. Full-vector
replacement still copies the cell slots; the growth proofs account for that
transport cost.

Nested statement-loop helpers carry the same caller-owned vector at every
selected boundary. Inner results return their updates before outer transitions
or following caller demands. Later inner entries reuse those owning cells;
skipped inner or outer loops leave recipes deferred. Inner entry expressions
use the current outer vector even when the inner body needs no memo state.

Selected lazy declarations inside iterations start a fresh unready cell whenever
their declaration is reached. The reset replaces only that cell in the latest
vector, retaining caller and enclosing-iteration state. Its recipe function
captures the current established iteration values at the declaration. Inner
helpers and later reads in that iteration share the payload; direct lazy aliases
reuse its cell without resetting it. An enclosing helper carries this vector
even when its only memo dependency is declared inside its own body.

Computed lazy bindings inside an initializer use a private extension of its
visible memo layout. Each actual initializer invocation starts with fresh local
cells; declarations create their getters only when reached. Nested initializers
extend that layout again. Calls to narrower outer getters merge the returned
prefix with the caller's unchanged local suffix, so ready siblings survive an
outer dependency's first demand. Returning trims the local extension while
retaining parent updates and the identities of returned or captured payloads.

Memo-bearing statement helpers may return to their exact enclosing source
function. Return payloads demand the current cells before completion lowering
propagates the source value through nested helpers. Normal exits still carry
the updated vector for following work; a function return needs no resumable
vector. Standalone blocks do not invent function ownership.

When construction supplies the owning function's self identity, a returning
recipe can finish with a private `tail` completion carrying its fully evaluated
argument array. It does not call the function from inside the getter. Nested
getters forward that completion unchanged; the original demand restores a
direct owning self return. Invocation-loop normalization and shared output
recovery can then lower it to a loop without a function/getter call cycle.
Immutable self aliases retain the same owner, while ordinary nested function
bodies and non-tail calls retain their normal call semantics.

Alias elimination also rewrites loop bodies without memo state and initializers
that remain lazy. Those deferred initializers retain their first-demand work.
A fresh lexical self snapshot preserves the owning function across declarations
and loop parameters that reuse its original binding identity. Region results
and local declarations still shadow their own incoming aliases.
Common physical preparation also gives free self reads an unshadowed function
binding before generating names; capture initializers keep their outer scope.

Tail completion is abrupt: the interrupted cell is never marked ready, and a
new owning invocation gets fresh cells, default setup and local declarations.
Arguments, including spreads and ignored extras, finish before the completion
leaves its recipe. Normal completion still installs one ready payload with its
ordinary sharing. These packets are private control transport; source arrays
with the same strings remain ordinary values. No outer-loop transfer is hidden
inside a lazy value operand.

## Owning returns in value regions

At source-function entry, the shared FAST [`returns`](../../js/ast/returns/module.f.mjs) pass lifts owning
returns in direct plain value blocks and conditionals used as required
initializers or return payloads. Within an exposed region, a single yielded
value can expose another such region. Statement blocks and conditionals bind
the normal value before its consumer; terminal returns skip that consumer and
following work. Zero/many normal results retain their existing array packing.
The lift runs before memo and loop-completion normalization, so reached lazy
demands and normal-path updates use the same state transport. No-return input
retains its existing graph path and syntax identity.

Eager unary/binary operands, `instanceof` values and plain spread-free call
callees/arguments can expose the same owning returns. Required snapshots
establish earlier operands before a later region can return; the operation or
call runs only on normal completion. Callable validation stays after arguments,
so a returning argument can bypass a noncallable callee. Value and statement
conditional tests can lift before selecting an arm; a terminal test skips both
arms.
`instanceof` evaluates only its value operand and retains the literal `Array`
constructor metadata. A returning operand skips the check; normal completion
retains its Boolean result.
Source logical tags stay outside eager lifting; their producer expands them
to canonical conditionals before normalized FAST construction.

Eager-call snapshots can retain redundant required anchors through the first
round trips. The mixed recursive-call fixture stabilizes by its third graph
conversion; subsequent conversions preserve that graph, metadata and runtime
identity. Existing named exact-graph domains retain their original checks.
Complex array/comma memo fixtures reach their fixed graph after three round
trips from the initial graph; later conversions retain that graph. Required
and comma anchors settle into the existing canonical-index order while every
intermediate preserves values, sharing, state order and metadata.

Non-spread array elements and nonempty comma sequences use the same ordered
snapshots. A return skips later elements and array allocation; a normal comma
keeps its last operand's value and callee provenance, while every preceding
operand remains required. Zero/many yielded values at an admitted value-region
root sequence in order and pack once into an array. Statement-result regions
retain their declared multiple-binding signatures.

Statement blocks and conditional arms can lift owning returns from their normal
yield operands. Required snapshots establish earlier results before a later
operand can return; a return skips the remaining results and following work.
Normal completion yields the original ordered result list to the same statement
bindings, preserving zero/one/many arity and normal-path signature validation.
This result-list mode is distinct from value-region array packing and from
source-function or loop-body root yields.

Non-spread object entries sequence each key through a required `String`
conversion before its property value and later entries. This is the object
kernel's own key conversion. A returning key skips conversion; a later return
retains every reached key conversion and property value. Normal completion
constructs the object from established string keys and values, preserving
duplicate keys, enumeration order, `__proto__` as data and value identity.

Closure capture expressions use ordered required snapshots in the enclosing
function's return context. A returning capture skips later captures, closure
construction and following work. Normal completion retains capture bindings,
value identities and function metadata; the nested body is normalized separately
under its own target. Reached capture demands share the selected memo vector
before closure construction. No-return inputs retain their syntax identity.

`break` and `continue` payloads use ordered required snapshots before memo and
completion lowering. A returning payload preserves earlier evaluations and
skips the remaining payloads and transfer. Normal completion retains the exact
target and zero/one/many result or next-state signature, including simultaneous
continue updates. Selected memo updates and payload identities follow the same
statement region through nested and outer-loop transfers. No-return inputs
retain their syntax identity.

Lazy initializers, loop entry operands and wrapped member/native
callees retain their evaluation boundaries. Plain-call admission preserves callee
provenance through wrapper regions and comma results.
Loop transfers cannot escape a lifted operand's own loop scope. Ordinary
nested functions are normalized at their own function entry.

Statement-level breaks and continues to enclosing loops carry their latest
memo vector with the target's user results or next state. A lexical owner chain
maps source targets to their private transport loops by identity. Control-only
helpers that escape to a selected ancestor join the same protocol, including
intermediate helpers with no lazy reads. Completion dispatch relays the packet
until the target processes its own result or transition. A continue retains
caller and enclosing-iteration cells; reaching local declarations in the next
iteration resets only those lifetimes. No helper invokes an enclosing helper.

Member and optional-call operands use the same return-lifting pass as common
target preparation. Required receiver and numeric-key snapshots precede the
`memberPresent` query, which preserves lookup failures before arguments.
Ordinary calls discard the Boolean; optional calls use it to select their
argument region. Normal completion retains receiver/key member-call syntax.
Optional receiver guards enclose keys, lookup and arguments. Closed `|!()`
boundaries retain argument evaluation outside a skipped optional region.
Selected lazy demands and normal-path memo updates follow those regions.
Array and call spreads materialize in source order before a later owning return.
Returning spread operands skip their expansion; normal completion retains item
order, argument/rest arity, Unicode string iteration and element identity.
Member lookup still precedes argument expansion, and skipped optional regions
skip it. Spread-bearing objects use entry-aware snapshots: each property key
converts before its value, while each reached spread copies own properties
before later control. Normal results preserve duplicate-key/enumeration rules,
`__proto__` as data, UTF-16 string properties and shared value identities.
Ordinary nested functions keep their own
bodies; their explicit capture values are evaluated at function creation.
External lazy environments without an AST recipe retain the existing refusal.
Value-owned loops share selected caller cells and retain their local recipe
lifetimes. Memo-bearing
standalone/operand blocks require default transfer semantics; custom transfer
callbacks retain their existing no-memo behavior.
Blocks without a crossing deferred binding retain their identity and previous
graph construction. Memo normalization runs before completion lowering and
root matching at each owning block boundary.

## Enclosing-function returns

[`loop/completions`](./loop/completions/module.f.mjs) carries statement-level
returns and outer-loop transfers through helpers. A terminal loop has no normal
completion: return-only helpers carry the owning function's result directly,
and several outward exit kinds dispatch exhaustively over their actual cases.
No normal fallback is added. For loops that can resume, only nonroot loops with
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
Already-normalized statement regions skip a repeated pass. Function bodies,
including reconstructed canonical invocation roots, use graph-level normal/control
joins for mixed statement regions. A join binds one selected normal result and
constructs its following graph once, sharing that exact expression across normal
exits. Prefix and condition expression identities are retained in both result
selection and control selection. Terminal returns and self calls stay direct;
no continuation function or eager terminal-payload envelope is introduced. Zero-result joins
need no result selector, and nonzero joins retain required result evaluation
even when a result is unused. Normal-only helpers
retain their previous graph path. Canonical invocation roots are exempt from
completion wrapping, so terminal public results and self calls stay direct;
their inner helpers can still return to the owning source function. Return
payload computations remain ordinary evaluations; broader tail-call eligibility
belongs to shared [tail-call analysis](../to_fast/README.md). Throws and failures
use the existing failure channel.

The graph join replaces the former continuation expansion for helper callers
and canonical invocation roots. The root resolver preserves statement regions
and rewrites only its owning transfers before ordinary graph construction.
After admitted operand returns are lifted, joins operate only in an owning
function's statement regions. Remaining operand regions reset that owner and
refuse nonlocal exits; standalone blocks do not invent a source function.
Normal-only regions keep their established lowering.

Statement summaries track whether a normal path reaches the next statement.
Dependencies from an unreachable suffix or final exit do not justify dropping
required prefix work. Within graph control, required definitions and loop calls
retain an anchor at their original entry even when a later normal path reads
their results: an earlier return must not skip that evaluation. References keep
the same expression identity, so the anchor and later reads share one result.
Dependencies reached by the eager entry prefix, including the first condition,
need no separate anchor. This retains established guard-read sharing across
graph conversions. Values read only by a branch or a later normal continuation
remain anchored. This conservative rule can retain redundant anchors compared
with ordinary result-only lowering.
Regions whose paths all throw also end graph control immediately, without
lowering their unreachable continuation.

## Canonical root loops

A canonical scalar invocation loop reuses its enclosing function. Its body
contains only aliases of established arguments, captures or self before the
loop, then a direct return of the loop's single result. Capture and self aliases
cannot replace the current argument at the loop entry. Its arity is one, it reads no rest
array, and the loop enters with that current argument. Reuse keeps the same
frame and self identity. One-time setup, a different invocation layout or
following result processing retains a separate helper.

The general root domain uses the complete invocation signature:
zero through sixteen fixed parameters, optional rest, and one opaque public
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

A rest root adds one internal state position after the fixed parameters, without
changing public arity. Entry rest follows its own alias lineage. Each reached
continue must use the shared [`invocation`](../../js/ast/invocation/module.f.js)
recipe: a final required private argument array, its fixed-prefix projections,
and a fresh rest slice. Reconstruction removes that private array and restores
the original call arguments, avoiding repeated wrapper growth. An arbitrary
borrowed array is not a rest-invocation recipe: reconstructing it as a call
would allocate a different rest array and lose sharing. Such loops keep the
general helper path. Unsupported hidden transfers also prevent rest-root reuse.

Within a matched general root, an owning `continue` constructs a direct self
call with all next values evaluated in the current invocation. An owning
`break` or function `return` supplies the public value directly. Targeted
statement blocks and conditionals resolve those transfers through the same
ordinary graph constructor. Ordinary regions retain their original values and
sharing. No completion/state envelope surrounds a tail call or public result;
an existing helper's argument and returned arrays remain opaque values.
Captures, retained self values, required work and observable arity keep their
ordinary function contracts. Source admission and shared
[tail-call analysis](../to_fast/README.md) remain separate owners.

## Graph identity and normalization

The direct graph round-trip domain uses canonical binding reads: one node per
argument, frame slot, rest or self binding in each scope, with explicit shared
value definitions and canonical required anchors. Literal undefined nodes use
one fresh occurrence per literal position; arbitrary sharing of the tagged
primitive and redundant discarded undefined anchors are outside this exact
graph domain. Function captures are
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

Shared tail-call analysis lowers terminal self-call evaluations through
canonical invocation roots, including spread and observed-rest invocations
with per-iteration parameter setup. Foreign or nonlexical loop targets, foreign
function-return targets and loop-body normal yields are refused explicitly.
Standalone block construction has no source function to own helper returns.
A deferred free binding is never eagerly captured to construct a helper.
[Structured loop construction](./loops.md) indexes these contracts and records
the member-resolution decision, spread boundary and integration evidence.
