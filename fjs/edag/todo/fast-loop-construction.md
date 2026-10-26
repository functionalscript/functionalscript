## Construct EDAG from structured FAST loops

**Priority:** P2
**Status:** wip — scalar loops, fixed-input roots, nested aggregate helpers,
statement-level transfers and normal-exit caller memo transport are implemented;
the end-to-end `memberPresent` query is implemented;
member/optional-call completion lifting is implemented;
array/call spread return lifting is implemented;
object-spread return lifting is implemented;
closure-capture return lifting is implemented;
loop-transfer payload return lifting is implemented;
loop-entry initializer return lifting is implemented;
native-callee return lifting is implemented;
wrapped-member callee return lifting is implemented;
remaining operand boundaries and broader memo lifetimes remain in E
**Blocked by:** [FAST contract, milestone A](../../todo/general-loops-and-tail-calls.md#implementation-order)

### Problem

General loops need a single graph-construction owner. Source-mutability
analysis, target loop spelling and EDAG helper construction are separate
concerns. This task owns scalar construction needed by foundation milestone B
and its generalization in E, in `fjs/edag/from_fast`.

### Input contract

Consume [normalized FAST](../../todo/compiler-vocabulary-and-modularization.md#fast-contract):
loop parameters and initial values, result signatures, immutable references,
and resolved break/continue/return targets. Branch results and required
evaluations are already explicit.

AST-to-FAST chooses which source bindings travel through a loop. This
conversion neither searches for outer mutable names nor performs liveness
analysis. Immutable free values use ordinary captures. Internal producers
maintain the contract; no repeated validation pass is added.

A loop may appear sequentially, in either branch, or inside another loop.
Keep its initial call and frame/argument construction at that execution point.
An unselected branch evaluates none of its loop setup; an inner loop gets a
new entry on every reached outer iteration.

### Helper construction

Unless the root-loop rule below applies, construct a local recursive function:

- Its state parameter carries the loop's declared parameter values. Preserve
  the established scalar single-variable graph where it already applies;
  use one ordered aggregate for the general signature.
- Each continue evaluates all next-state values under the current iteration,
  then tail-calls this helper with the new state. Body fallthrough has already
  become an explicit continue.
- Each normal break returns the loop's declared result values. These need not
  be the entire input state: the input and result signatures are distinct.
  The general helper returns one aggregate in result-signature order, including
  zero or one result; only the established scalar case retains its scalar result.
- The caller binds those results and resumes after the loop. It does not copy
  following statements into exit sites.

The signature order comes from FAST. Source construction uses resolved binding
introduction order; source-free graph conversion uses its documented stable
operand order. Printed names and map iteration do not determine state layout.
The general aggregate avoids the source fixed-parameter limit; internal state
packages never become a user result accidentally.

For example, the structured FAST:

```text
r = loop L(n = initial) -> (value) {
    if (done(n)) { break L(n) }
    continue L(next(n))
}
use(r)
```

constructs a recursive helper whose normal result is the value bound as `r`.
A second loop consumes the first loop's results at its own entry point.
No source-level closure is introduced before source capture checks.

### Shared lazy demand state

A free reference is not permission to establish a lazy initializer while
constructing the helper. For example, a lazy value read only in a skipped
loop arm remains unevaluated, and one first demanded inside the loop is reused
by later iterations and following statements in its owning invocation.

Thread an ordered internal memo vector alongside the helper's user state.
Each cell carries an initialized flag and its established value; the flag
distinguishes an undemanded initializer from any source payload. A demand
selects the stored value or evaluates the initializer with the current memo
state, then supplies the value and updated memo state together. Failed
initialization uses the existing failure channel and never supplies a ready
cell. Conditional regions update only the selected arm's state.

Internal continues carry next user state and memo state simultaneously.
Normal helper completions and resumable outer-loop transfers carry the updated
memo vector back to the caller for subsequent demands and sequential loops.
Source-function returns demand their payload before propagating it; the owning
function exits without resuming memo state.
Nested helpers receive the same owning cells and return their updates to
their caller; no generated helper directly invokes an enclosing helper.
The declared normalized loop input and result signatures remain unchanged.

Initializer recipes depend on established immutable values or other memo
cells. Discover those dependencies through their resolved identities without
performing source write analysis. Capture established prerequisites normally;
thread undemanded dependencies as cells instead of evaluating them to build
the frame. A lazy definition introduced inside an iteration starts fresh on
each new iteration, while an enclosing invocation's cell survives it. Nested
loops share an outer iteration's cell only for that iteration's lifetime.

The general internal state/result packages include this bookkeeping. The
existing scalar graph remains unchanged where no such demand state crosses
the helper boundary. Pin the memo-bearing graph normalization and stable
cell ordering with its first implementation.

The first normal-exit increment uses a lexical `loop/memo` pass before
completion lowering. Caller-owned deferred roots and their direct lazy aliases
share cells ordered by definition. A fresh private loop carries
`[userStateArray, memoVector]` and returns `[userResultsArray, memoVector]`;
required projections preserve the original loop binding identities. Original
source loop signatures and public function metadata stay unchanged, and blocks
without a crossing deferred binding keep their existing graph path.

Each selected declaration has a private recipe function that captures its
established prerequisites there and accepts/returns the current memo vector.
Cell aliases activate at their exact declaration and follow lexical shadowing;
an earlier Environment read cannot become a read of a later local cell. Required
definitions and region/loop binders establish their own values. This adds one
private recipe function per cell to the memo-bearing normalization while
retaining the no-memo exact graph domain. External lazy provenance follows
aliases and is refused before a recipe helper could capture it eagerly.
Statement-region occurrences have distinct planning identities even when the
input reuses an immutable declaration, block or loop object; source bindings
and targets retain their identities.

Caller-owned dependent recipes join the same cell vector through transitive
prerequisite/dependent closure, in source definition order. Their conditional
demands carry only the selected dependency updates. A newly initialized cell is
installed into the recipe's returned vector, preserving prerequisite identity
for later iterations, sequential helpers and caller reads.

Capturing established prerequisites and earlier recipe functions does not
initialize source lazy values. Shared recipe functions prevent
conditional dependency DAGs from being recursively copied at each demand;
full-vector replacement retains its ordinary slot-copying cost.

Nested normal-exit statement helpers carry the same caller-owned vector through
every selected boundary. Inner entry demands use the current outer vector, and
inner results return updates before outer transitions. Reentering an inner
helper reuses the owning function's cells; skipped entries leave them deferred.

Iteration-local declarations reset their selected cell at each reached source
declaration and define the getter from that iteration's established values.
The reset preserves caller and enclosing-iteration cells; aliases share their
root without resetting it. Selected helper ancestors transport the vector even
when a local declaration hides the dependency from their free-binding set.

Recipe-local computed lazy bindings extend their owning getter's memo layout.
Each initializer call appends fresh local cells, with getters created at their
reached declarations. Narrower dependency calls receive only their prefix and
merge returned updates with the caller's local suffix. A getter returns its
parent width, retaining dependency updates and any returned payload identities.
Statement helpers may return to the exact enclosing source function. Memo
normalization evaluates the return payload with the current cells, then the
existing completion pass propagates that payload through enclosing helpers.
The function exits with its source value; normal helper exits still carry the
memo vector for following work. Standalone and operand regions do not inherit
function ownership unless an admitted value region is first lifted below.

The first value-completion increment lifts direct plain block and conditional
values used as required initializers or source-function return payloads. A single
yielded value in an exposed region can continue that chain. Their normal results
bind before the original consumer, with existing scalar/zero/many packing;
terminal owning returns skip the consumer and suffix. The lift runs before memo
and loop-completion lowering, preserving their shared identity and state rules.
No-return inputs retain their existing syntax identity.

Eager unary/binary operands, `instanceof` values, plain spread-free call
callees/arguments and value or statement conditional tests can lift through
the same regions. Earlier operands become required snapshots before a later
region can return; only the normal path applies the operation or call. Callee
evaluation precedes arguments, while callable validation follows them. A
terminal guard skips both arms.
The `instanceof` constructor remains literal metadata: only its value operand
is evaluated. A returning operand skips the check; normal completion retains
the Boolean result.
Required callee snapshots can introduce redundant anchors in the new eager-call
graph domain: its mixed recursive fixture has 24 then 22 nodes and stabilizes
by the third graph conversion. Every intermediate preserves arity, captures,
rest/self behavior and returned identity; later conversions retain that graph.
Non-spread arrays and nonempty comma sequences reuse ordered snapshots. A normal
array allocates after its operands; a comma keeps its last operand's value and
callee provenance while requiring every preceding evaluation. Zero/many normal
yield values at admitted value-region roots sequence and pack into one array;
ordinary statement-result regions keep their original multiple-binding arity.
Statement blocks and conditional arms sequence normal-yield operands through
required snapshots when an owning return crosses a result expression. Normal
completion retains the original result-list arity and binding identities;
returning paths skip the remaining results and consumer. Result-list lifting
does not change source-function or loop-body root yields, and the existing
normal-path signature check still rejects a mismatched yield count.
Complex array/comma/object memo fixtures settle their required/comma anchor order
after three round trips from the initial graph, with state order, sharing,
metadata and execution preserved through every intermediate. Further round
trips retain that fixed graph.
Non-spread object entries use required `String(key)` snapshots before each
property value and later entries. The operation calls the same conversion as
the object kernel, so key-coercion failures cannot disappear behind a later
successful return. A key's own return skips conversion and all remaining work.
Only normal completion builds the object from established string keys and
values, retaining duplicate-key and enumeration rules, `__proto__` as data and
value identities. No-return inputs retain their original object syntax.
Plain-call admission retains callee provenance through wrappers and comma
results. Established static and intrinsic callable leaves and the `entry` and
`hasEntry` helpers admit argument return lifting through the same sequencer.
Required callee snapshots precede arguments: a missing or failing static
provider still fails at the read before a later argument can return. A returning
argument skips invocation and the remaining arguments or spreads; normal paths
retain ordinary invocation behavior. Value blocks, conditionals and comma
results carry that existing callee provenance. Property-ending chains supply
values too. In an ordinary call with a block, comma or conditional callee,
establish the selected property read before arguments and retain detached
invocation. Prefix, receiver, computed-key and read failures precede a later
argument return; unselected callee arms stay unevaluated. Returning arguments
skip invocation and remaining work. This value extraction preserves ordinary
property lookup without introducing method dispatch. Direct syntactic member
calls and in-chain optional calls retain their existing receiver/query protocol.
JavaScript rendering recognizes property syntax exposed by erased trivial blocks
and singleton comma expressions, retaining detached ordinary calls on normal
paths as well as return-bearing paths.
Member and optional-call operands use the shared FAST return
normalizer and the member-resolution protocol below. Closure captures sequence
their construction-time expressions using the enclosing function owner. Earlier
captures remain required before a later capture can return; a return skips the
remaining captures, function construction and suffix. Normal completion retains
the original capture bindings and function metadata. The nested body remains
untouched by that lift and normalizes at its own function entry. Selected memo
updates and captured identities follow the same construction region.
`break` and `continue` payloads use the same ordered snapshots in the statement
region. A return preserves reached payload evaluations and skips the remaining
payloads and transfer. Normal completion retains the exact target and ordered
zero/one/many signature; all continue values establish before simultaneous state
transfer. The existing memo and completion passes carry selected updates and
payload identities through nested and outer-loop transfers. No-return inputs
retain their syntax identity.
Loop entry values use ordered required snapshots in the enclosing region,
before the new loop target or its parameter bindings enter scope. A return
preserves reached initializers and skips the remaining values, loop and suffix.
Normal completion enters the loop once with the established values in declared
parameter order, retaining the exact target and result signature. Caller and
enclosing-iteration memo cells keep their existing lifetimes; each reached inner
entry remains fresh. One-time entry setup keeps the existing helper fallback
when it prevents canonical invocation-root reuse. No-return inputs retain their
syntax identity.
Lazy initializers retain their separate demand/completion boundary.
A loop transfer cannot escape the operand's locally owned
loop chain.

Statement-level outer-loop breaks and continues use the same private
`[userValuesArray, memoVector]` transfer payload as owning exits. Lexical source
targets map to their exact private loop targets; the existing completion pass
relays the pair until that target supplies results or starts its next iteration.
Control-only helpers escaping to selected ancestors join the transport plan,
including intermediate helpers with no memo reads. Newly selected targets can
require further control helpers, so selection closes over those escape paths.
Payload evaluation supplies the latest vector before every transfer. Continued
iterations retain caller and enclosing-iteration cells and reset their own local
lifetimes at reached declarations. Foreign targets and operand escapes remain
refused.
Demand-only guarded operands that are not exposed by return lifting retain their
existing refusals. External lazy environments have no AST
recipe for this pass and keep the existing refusal.

### Enclosing-function returns

A loop helper with only normal exits returns its results directly. If the
loop can return from the enclosing source function or transfer to a lexically
enclosing loop, use the internal completion forms:

```text
["normal", resultValues]
["return", value]
["break", targetId, resultValues]
["continue", targetId, nextValues]
```

These forms are private to this conversion. `targetId` is a deterministic
encoding of the resolved loop identity in the owning function's statement
inventory, not a printed name or the identity's presentation index. Standalone
blocks and operand-local blocks use their own lexical inventory; a transfer
cannot cross an opaque operand or ordinary function boundary. FAST, admission and
serializers know only their own loop/result/return constructs.

Statement-level enclosing returns and outer-loop transfers use
[`loop/completions`](../from_fast/loop/completions/module.f.mjs) normalization. A
nonroot loop with escaping control receives one internal completion-result binding;
the existing aggregate helper carries that slot in its result array. Caller
dispatch binds the original normal results, returns the payload to the source
function, or emits the resolved targeted break/continue. Parent helpers encode
only dispatches that still escape their loop, without invoking an
enclosing helper. Normal-only loops and canonical invocation roots retain their
previous paths. A root's inner returning helpers can introduce dispatch, while
its terminal public result and direct self calls remain unwrapped.

Graph-level normal/control joins handle function bodies and reconstructed
canonical invocation roots, replacing the former continuation expansion. Each
normal join binds selected region results and constructs one shared following
graph; terminal return/self call computations stay direct. Prefix/condition
expression identities are shared between control and normal-result selection.
No extra invocation or eager terminal completion product is introduced. The owning function target is retained
for statement regions and reset at operand boundaries. Canonical invocation-root
reconstruction preserves those regions while rewriting its owning transfers.
Ordinary nested function bodies and value operands are not traversed by this
normalization. Payload computations remain ordinary evaluations; their broader
tail-call eligibility belongs to F. Value-operand completions remain open.

Loop IDs follow lexical introduction order within each normalization scope,
independently of debug indices. Dispatch uses original target result/parameter
signatures before helper packing and declares original result bindings once.
Standalone block normalization runs before helper construction too; operand
regions normalize local loops on entry, while statement regions reuse the
already-completed pass. True foreign or nonlexical targets remain raw for the
existing owner checks to refuse. Return-only completion graphs retain their
previous shape.

A caller resumes after the loop for normal completion. A source-function
return propagates through enclosing generated helpers until its owning
function returns the payload. A break or continue targeting an enclosing loop
propagates until that loop's caller processes its own result or transition;
intermediate helpers do not perform the outer transition. An ordinary nested
source function owns its own returns. Source values resembling completion
tags remain payloads, not control signals. Existing throws/failures propagate
through the existing failure channel; there is no additional failure tag.

An inner helper returns to its caller. It never calls an outer helper to
continue an outer iteration: that would create a recursive call cycle which
self-tail-call elimination cannot make stack-safe. The caller processes the
inner result and performs its own transition.

### Canonical root loops

The fixed-input increment implements direct reconstruction for zero through
sixteen fixed parameters, no rest binding and one opaque public result, while
keeping the established scalar shape first. Its contract lives in
[`from_fast/loop/root`](../from_fast/loop/root/README.md). This is part of E;
normal-exit general helpers, including nested helpers, are also implemented.
Operand control and rest transitions remain open below.

The former fixed-input root constructor copied the following suffix into each
normal exit of a region with nonlocal exits. For example, both arms below can
return or yield, so repeating this statement previously grew the suffix
exponentially:

```text
if (condition) {
    if (stopA) { return F(a) }
    yield ()
} else {
    if (stopB) { return F(b) }
    yield ()
}
followingStatements
```

A bounded reproduction grew the normalized function from 4,949 bytes for four
such statements to 79,349 for eight and 1,269,749 for twelve. The root resolver
now preserves statement regions for the graph owner's shared normal/control
joins. The following graph is constructed once and shared across normal exits,
as it is for noncanonical helper callers. Terminal public results and self calls
remain direct, without a continuation function or eager completion payload.

The canonical-root proof includes fixed invocation inputs, a captured value,
simultaneous next-state updates and a required suffix call/allocation. Its
normalized FAST and unique graph nodes grow linearly:

| Mixed regions | Unique graph nodes | Normalized FAST bytes |
| ---: | ---: | ---: |
| 4 | 32 | 2,817 |
| 8 | 44 | 4,329 |
| 12 | 56 | 5,841 |

Every size has one suffix call and allocation, one direct self call and one
function. Existing exact graph fixtures remain unchanged; mixed result regions
bind selected normal values through the graph join rather than per-arm suffix
definitions.

Normalized loop bodies already have explicit transfers and no implicit
fallthrough. A reached loop-body `yield` violates that precondition and is
refused, rather than being interpreted as a return or a new iteration.

Implement the scalar form needed by common existing output during B, before
output migration C. E extends it to general invocation/result signatures.
The FAST contract in A names the exact-graph domain. If canonical root reuse
conflicts with an existing source-to-graph expectation, record the specific
normalization and update its contract/fixtures in A/B before C; do not assume
that removing a wrapper preserves its identity or defer the conflict to a writer.

Reuse the enclosing function for the canonical root-loop form only when all
of these structural conditions hold:

1. Its body is the loop and a direct return of that loop's single result,
   allowing only aliases of invocation inputs outside the loop. No required
   computation, allocation or invocation setup stands before it.
2. Loop entry values are exactly that function's current invocation inputs.
   The fixed-argument/rest layout and each next-invocation transition agree.
   Default/destructuring setup that repeats per call stays inside the loop.
3. Captures and retained self references refer to the same enclosing function;
   reuse does not change its frame, identity or observable arity.
4. A normal loop exit supplies the function's result directly. A source return
   targets that same function. No following computation or completion/state
   decoder must run after the loop.

A loop merely appearing first does not satisfy this rule. Otherwise use a
helper. If a future case needs more reuse, extend this rule with its positive
and negative graph fixtures rather than introducing a second heuristic.

`to_fast`'s eligible direct-self-loop form follows this contract so reading
its normalized FAST back does not add a wrapper. Physical prepared FAST is
not the input to `from_fast`.

### Member-resolution decision

Lifting argument control must preserve the lookup boundary. In
`null.f(argument-block-returning-7)`, lookup fails before that successful
return; calling an already evaluated noncallable value instead reaches the
arguments before callable validation. A nullish optional receiver skips its
key and arguments. A plain property read cannot express the optional-call
guard for native methods: it may yield undefined where a member call exists.

Choose the minimal internal query `['memberPresent', receiver, key]` for E.
It returns the existing optional-member-call guard's Boolean result or the
lookup failure. A true result permits argument evaluation; callable validation
belongs to the subsequent call. The internal query is implemented across
schema, graph conversion, evaluation and target output. The shared FAST return
pass uses it to lift owning returns through member and optional-call operands.

The alternative is a first-class resolved-member value plus an invocation
form. It could retain one resolution across argument control, but would add a
value kind, identity and invocation contracts to the schema, runtime and
consumers. The Boolean query reuses the current member-call representation and
accepts repeated pure resolution. Revisit that choice only with evidence that
its lookup cost warrants the larger contract.

#### Query contract

Use the existing EDAG `Index` and FAST `Key<V>` vocabulary: a string or number
literal, or an explicit `['Number', value]` key. Reuse schema `index`,
`mapKey`/`keyOperands` and graph-key conversion. Property-name admission remains
the same as for member access; this query introduces no arbitrary value-key
conversion or additional admitted names.

Evaluate the receiver, then the key and its existing numeric conversion, then
resolve the member. An ordinary nullish receiver therefore fails after a
reached computed key; a returning key skips lookup. A receiver-optional region
must guard the key and query outside this operation. When lifting, establish
the computed key and its conversion in a required snapshot and reuse the
established primitive key in the query and call.
Computed keys retain the existing `['Number', ['ref', binding]]` wrapper around
the established number; a bare binding reference is not an `Index`/`Key`.

Derive one shared resolver from
[`operations.property`](../operations/module.f.mjs) and reuse it for the
existing call and the query:

1. Perform [`read`](../value/property/module.f.mjs) first and propagate its
   failure, including nullish-receiver and static-function `length` failures.
   The operation spells the already-converted string/number key with `String`.
2. Retain exact stored-object own-property presence, even for a stored undefined
   value. An own field suppresses native/runtime fallback.
3. With no stored own field and an admitted built-in name, use the existing
   [`hasMethod`](../value/method/module.f.mjs) guard. Otherwise answer whether
   the read value is nonnullish. Reuse the current method inventory.

| Resolved case | Query outcome |
| --- | --- |
| Stored own null or undefined, including under a native method name | False; the own field shadows fallback. |
| Stored own nonnullish value, including `0`, `false` or a function | True; no callable check yet. |
| Nonnullish indexed value or ordinary `length` property | True, even when the name is not admitted as a method. |
| Missing field with no admitted native/runtime method | False. |
| Admitted native implementation with no runtime override | True after the existing runtime-resolution step. |
| Admitted runtime-only method with no implementation | False. |
| Runtime resolution for an admitted method answers any value other than represented undefined | The existing runtime guard is true, including for null or a noncallable value. |
| Property read or runtime resolution fails | Propagate that failure before arguments. |

The runtime guard's test is the existing `hasMethod` contract, which differs
from the nullish test on a stored own value. The query may execute the lookup
provider and receiver-stage method body; it evaluates no call arguments and
invokes no resolved argument-stage callable or native method.

#### Control and receiver preservation

For an ordinary member call, require the query before lifting arguments and
discard its Boolean result. False still reaches the arguments and the
subsequent ordinary call. Thus a successful argument return can bypass a
missing/noncallable callee, while a lookup failure cannot disappear behind it.

For an optional member call, place arguments and invocation only in the true
branch of the query. A receiver-optional guard encloses key evaluation, the
query and those arguments. Preserve the original receiver/key member-call
form on the normal path so native dispatch and runtime receiver binding stay
intact. Bare optional calls use their evaluated callee's nullish test.

Keep the existing chain state and skip continuation, including `|?.()` regions
and `|!()` boundaries. A skipped region skips its own keys and arguments;
a later forced call outside that region still reaches its arguments. Common
construction/preparation owns this control flow; target writers spell the
prepared query and call. Retain required prefixes, exact transfer owners,
selected memo updates and captured value identities through every path.

The shared `js/ast/returns` pass runs before graph memo/completion lowering and
at physical preparation's member boundary. A terminal forced call joins outside
optional guards so its arguments are sequenced once. A live member carries its
receiver and established key through ordinary block results alongside a live
flag; a skipped member carries placeholders that the false flag leaves unread.
This is internal control transport, not a resolved-member runtime value.
Prefix blocks nest without copying the remaining suffix. No-return inputs
retain their original syntax identities.

#### Accepted lookup cost

Repeated resolution is valid under the existing pure runtime contract. In the
current JavaScript operation kernel, a reached admitted built-in call with a
callable runtime `dot` and normally completed arguments performs two `dot`
invocations. A query followed by the retained ordinary call performs three:
the query, preargument call resolution and invocation resolution.

That is a conditional cost example. Stored own fields and ordinary indexed
reads use no `dot`; a false optional query skips replay; an argument return
stops after the query; and no callable runtime `dot` means no actual `dot`
invocation. Replaying a read can also repeat other lookup work, such as
`runtime.static` when reading a static function's `length`. These counts
exclude argument and selected-member body work. Counts can differ by backend;
they describe cost, not semantic counters programs or proofs may observe.

#### Backend reconciliation

The chosen query contract above comes from the JavaScript operation kernel.
NaNVM's [`Member::body`](../../../nanvm/lib/src/vm/lambda/member.rs) now
consults the runtime only for admitted names and treats every runtime answer
other than undefined as present, including null and noncallable values.
Stored own null or undefined still shadows fallback and is absent.
Its ordinary [`PropertyLambda::end_call`](../../../nanvm/lib/src/vm/lambda/mod.rs)
and continued member-call paths resolve before evaluating arguments, while
optional paths use their guard's resolution. The query reuses that machinery.
Runtime-only admission metadata is generated from the shared method inventory;
it does not add another handwritten name list.

The native JavaScript writer has no configurable represented-runtime argument.
It uses the host implementations of the existing member inventory, with own
field/index/length handling and no exposure of unsupported prototype values.
Absent/custom-runtime fixtures apply to the represented and NaNVM executors;
canonical-runtime fixtures also compare native JavaScript. Cross-backend
fixtures pin presence, skips and failures before enabling member lifting.

#### Implementation and evidence gates

First add the query end to end: closed schema/types, index admission,
analysis/identity and content hashing, FAST operand mapping, both graph
conversions, represented evaluation, common preparation, JavaScript and Rust
emission, and NaNVM/runtime support. Reuse and align the current Rust member
resolver/guard under the contract above; preserve runtime capture/bootstrap
requirements in all targets.
Pin the query's distinct shape and stable round trips while retaining existing
canonical forms. Only then enable completion/memo lifting at member and
optional-call boundaries with the control rules above.

Use internal FAST value regions for returning operands in these fixtures:

| Evidence | Required distinction |
| --- | --- |
| Null receiver versus a noncallable member before a later successful argument return | Lookup failure versus that exact returned payload. |
| Nullish optional receiver with a failing or returning computed key | Key, query and arguments are skipped. |
| Own null/undefined shadowing a native name; own `0` or `length` | False guard skips arguments; true guard reaches arguments before callable failure. |
| Native method whose plain property read is undefined | The guard finds the implementation and preserves its receiver. |
| Static-function `length` requiring a missing or failing runtime body | The full property read retains its failure before arguments. |
| Runtime-only method bound, absent or failing; runtime override versus an own field | Existing guard result and own/runtime/native precedence, including noncallable runtime answers. |
| Returning computed key or argument | Preserve the reached conversion/prefix and payload identity; skip remaining work. |
| Continued optional regions and a closed `|!()` boundary | Preserve selected skips and later forced-call argument evaluation. |
| Caller, iteration and initializer memo cells plus returned closures | Preserve selected updates, aliases, receiver captures and fresh invocation lifetimes. |
| Invalid query tag/arity/key encoding and repeated graph conversions | Closed admission, metadata/sharing and stable canonical round trips. |

Run the admitted corpus through represented executors, emitted JavaScript and
Rust/NaNVM, including lookup failures and selected/skipped control paths. Run
scoped FunctionalScript proofs with full coverage, type-check, self-compile,
run the required Rust checks and check affected demos. Failure fixtures pair
one reached failure with a later successful return. Cases where both paths
fail do not pin a diagnostic; pure callback counts are not semantic observations.

### Spread boundary

Expand an earlier array/call spread before a later value operand can return or
transfer. Snapshotting only the spread operand does not preserve a failing
expansion before a successful transfer. This boundary belongs to common
preparation and construction, alongside member resolution; target writers do
not independently infer it.

The shared FAST return sequencer establishes each reached spread operand, then
requires an ordinary array construction containing that one spread. Later
operands run only after this materialization succeeds. The final array or call
retains the original item tags around references to the expanded arrays, so
replaying a spread cannot expose a deferred expansion failure. An owning return
inside the original operand skips its expansion and all later work.

Member lookup remains before argument expansion, and optional guards enclose
their spread operands and materializations. A forced suffix expands its items
once after the optional region joins. Array elements retain their identities;
strings use the existing Unicode code-point iteration, including lone
surrogates. No new node or iterable protocol is introduced. Logical no-return
inputs retain their original syntax identities.

Physical preparation retains its existing outward-control and bare-callee
domain, including standalone regions without a recorded function owner. Its
operand sequencer uses the same expansion constructor when snapshotting an
earlier spread before a later statement prelude. Both target writers consume
that common prepared plan.

Object literals sequence their entries rather than inferring key positions
from operand parity. A property contributes a required `String(key)` followed
by its value; a spread contributes one operand and a required ordinary object
materialization. Returning operands skip their own conversion/copy and the
remaining entries. Normal completion rebuilds the original entry tags around
established string keys, values and copied objects.

The existing own-property kernel supplies duplicate-key replacement, integer-key
enumeration, ordinary insertion order and `__proto__` as data. Strings contribute
UTF-16 code-unit properties; arrays contribute indices; nullish values and other
non-object primitives contribute none. Copied property values retain their
identities. This introduces no getter or foreign-object protocol.

Physical object snapshots use entry metadata too: keys convert before any
hoisted value prelude, and earlier object spreads copy before later outward
control. No-prelude objects retain their ordinary spelling; standalone regions
retain the existing physical ownership domain.

### Identity and evidence

Preserve established exact-graph loop cases outside any normalization explicitly
recorded in A/B. For each general signature and
completion form, record its graph shape with the first implementation.
Promise exact EDAG -> FAST -> EDAG equality only for the named canonical
domain, accounting for the separate short-circuit schema migration.
Other supported conversions preserve semantics and explicit sharing under
their documented normalization. Repeated conversions must stabilize.

- [x] **B:** Preserve the existing scalar construction and implement scalar
      root-loop reconstruction required by C. Pin its exact-graph domain and
      any explicit normalization before migrating output.
- [x] **E, after D:** Construct normal-exit general helpers using explicit loop signatures.
      Cover different input and output arities and state beyond the source
      fixed-parameter limit. State and result arrays follow the declared order;
      the scalar shape remains first. The common root resolver constructs the
      packed invocation loop, and the caller shares one call across projections.
      Generated state-slot reads are established at iteration entry, including
      required anchors for unused slots of the already-evaluated internal state
      array. This extends the earlier lazy-slot graph normalization so nested
      helpers capture established iteration values. Scalar graphs are unchanged;
      repeated conversions stabilize.
- [x] Preserve sequential and conditional execution regions, including
      unevaluated setup in an unselected branch.
- [x] Extend normal-exit helper construction to nested execution regions.
      Each reached inner entry is fresh for its outer iteration; normal results
      return to the caller before its following work or transition.
- [x] Implement normal results and statement-level enclosing-function completion propagation.
      Cover several breaks, nested returns, source nested-function returns,
      completion-shaped user values and failures.
- [x] Handle owning-function returns in plain value blocks and conditionals
      used as required initializers or function-return payloads.
- [x] Lift owning returns through eager unary/binary operands, conditional
      tests and plain call callees/arguments, retaining required prefixes.
- [x] Lift owning returns through non-spread array elements, comma sequences
      and multiple normal-yield values in admitted value regions.
- [x] Lift owning returns through non-spread object keys and values, performing
      key conversion before each property value and preserving object identity.
- [x] Lift owning returns through the `instanceof` value operand, preserving
      literal constructor metadata and normal Boolean results.
- [x] Lift owning returns through ordinary statement-result yield operands,
      preserving result binding identities, arity and evaluation order.
- [x] Record the member-resolution guard choice and its evaluation contract,
      receiver preservation, lookup cost and implementation evidence gates.
- [x] Add `memberPresent` end to end using the shared member resolver and
      existing index vocabulary before enabling member-argument lifting.
- [x] Lift owning returns through member and optional-call operands using the
      query, retained receivers and existing chain-region boundaries.
- [x] Lift owning returns through spread-bearing arrays and calls, expanding
      each reached spread before later control while preserving optional skips.
- [x] Lift owning returns through spread-bearing object literals, preserving
      key conversion, own-property copying, enumeration and value identities.
- [x] Lift owning returns through closure capture expressions, preserving
      construction order, enclosing ownership, memo state and captured identities.
- [x] Lift owning returns through `break` and `continue` payloads, preserving
      evaluation order, exact targets, signatures, memo state and simultaneous updates.
- [x] Lift owning returns through loop-entry initializers in enclosing scope,
      preserving evaluation order, exact targets, state signatures and memo lifetimes.
- [x] Lift owning returns through arguments to established native callees and
      their wrappers, preserving callee reads before arguments and normal invocation.
- [x] Lift owning returns through arguments to wrapped member callees,
      preserving selected property reads before arguments and detached invocation.
- [ ] Extend completion handling to lazy initializers, preserving first-demand
      evaluation and memo lifetimes.
- [x] Propagate statement-level resolved breaks and continues through inner helpers to their
      enclosing target without recursive helper cycles. Distinct target
      identities with the same presentation index remain distinct.
- [x] Share caller-owned lazy cells across normal-exit helpers and their caller.
      Cover conditional and zero-iteration demand, aliases, sequential helpers,
      simultaneous state/memo transitions, skipped failures and shared identity
      across iterations/following code. Keep no-memo graphs and public loop
      signatures unchanged.
- [x] Share caller-owned dependent lazy recipes through normal-exit helpers.
      Preserve transitive/conditional demands, shared prerequisite identity,
      caller-only dependents and bounded construction of recipe DAGs.
- [x] Share caller-owned lazy cells and dependent recipes through nested
      normal-exit helpers. Preserve inner-first demand, skipped failures and
      shared identity through inner results and outer transitions.
- [x] Give lazy cells declared inside loop iterations fresh declaration
      lifetimes. Share reached values with nested helpers and same-iteration
      reads while retaining caller-owned state.
- [x] Give computed lazy bindings inside initializers recipe-owned cells.
      Preserve local sharing, skipped demands and fresh local lifetimes when
      an owning initializer is evaluated again.
- [x] Return from memo-bearing statement helpers to the owning source function.
      Preserve demanded payload identity, normal-path updates and skipped failures.
- [x] Carry shared demand state through outer-loop breaks and continues.
      Preserve fresh iteration lifetimes and selected updates through every completion.
      Track exact ancestor targets and control-only intermediate helpers.
- [ ] Implement the root-loop rule with exact fixtures, including rejection of
      one-time setup, changed invocation layouts and following result processing.
- [x] Share normal continuations in noncanonical helper callers at graph
      construction, retaining direct terminal values and selected required work.
- [x] Extend the graph join to canonical invocation-root reconstruction and
      close the measured mixed-region suffix-growth case above.
- [ ] Keep the existing scalar shape; pin deterministic general state/capture
      ordering and stable repeated conversions.
- [ ] **F integration:** With shared emission, run repeated nested loops without
      recursive helper cycles or stack growth proportional to iterations.

### Related

- [Epic](../../todo/general-loops-and-tail-calls.md) — order and integration gates.
- [Compiler architecture](../../todo/compiler-vocabulary-and-modularization.md)
  — FAST and conversion boundaries.
- [Source bindings and loops](../../../spec/todo/3220-let.md#later)
  — selection of explicit loop state and source admission.
- [Tail-call loops](./tail-call-loop.md#general-tail-calls)
  — recognizes helper tail evaluations and prepares shared output.
- [EDAG](../README.md) and [function text](../function-text.md)
  — current sharing, identity and output contracts.
