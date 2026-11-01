# Structured loop construction

`fromFast` constructs recursive EDAG helpers from normalized FAST loops. Source
state selection, graph construction, tail-call analysis and target spelling
have separate owners in the [compiler architecture](../../compiler/architecture.md).
This document indexes the construction contracts and records the decisions
behind control-sensitive member lookup and spread expansion.

## Input contract

Construction consumes [normalized FAST](../../todo/compiler-vocabulary-and-modularization.md#fast-contract):
explicit loop parameters and initial values, independent result signatures,
immutable references, and resolved break/continue/return targets. Source
admission and write/capture analysis are complete. Physical prepared FAST is
never an input.

The [required-evaluation contract](./README.md#required-evaluation-and-graph-normalization)
preserves reached initializer, import, loop-entry and failure order. An
unselected branch performs none of its loop setup. Inner loops enter freshly
on each reached outer iteration. Internal producers maintain these invariants;
construction does not repeat source-mutability or liveness analysis.

## Helper construction

The [helper contract](./README.md#helper-construction) preserves the established
scalar shape where it applies. Other loops pass one ordered state array and
return an ordered result array, including zero or one result. Every next value
is established before a continue; the caller binds normal results and resumes
its following work once. The declared FAST signature determines slot order,
without the source fixed-parameter limit.

[`loop/invariant`](../../js/ast/loop/invariant/module.f.mjs) can retain the scalar
helper when extra slots forward established, nondeferred entry values exactly.
It keeps required entry demands and loop execution anchored even when only an
invariant result is used. Computed/deferred entries and hidden owning transfers
retain their general helper. This uses explicit transfer facts, preserves the
source-selected signatures and performs no source-write or liveness analysis.

## Shared lazy demand state

The [memo contract](./README.md#shared-lazy-demand-state) gives each selected
lazy declaration a private recipe and a cell containing a ready flag and its
value. Ready flags distinguish deferred initializers from every source payload.
Only a reached first demand initializes the cell; failure or an owning return
does not mark it ready. Aliases share a cell, while declaration occurrences and
shadowed bindings keep their lexical identities.

Caller cells survive sequential and nested helpers. Iteration-local cells reset
at reached declarations, and recipe-local cells use their initializer lifetime.
Required projections and selected memo updates travel with the declared user
state without changing public signatures. Ordinary function bodies and deferred
initializers retain their own planning boundaries; eager operands and capture
expressions participate in their owning lexical inventory. External lazy
substitutions without an AST recipe are refused before helper capture could
force them eagerly.

## Enclosing-function returns

A terminal loop ends its FAST block and has no normal completion. Its helper
computation supplies the block's EDAG goal. If all completing paths return to
the same owning function, their values become the helper result directly;
there is no normal/return tag test or fabricated fallback. Multiple outward
transfer kinds use an exhaustive dispatch over their actual outcomes.

The [completion contract](./README.md#enclosing-function-returns) transports
private normal/return/break/continue packets through generated helpers. Resolved
target identities and lexical introduction order determine dispatch, independently
of printed names and debug indices. Source payloads that resemble packets stay
ordinary values; throws use the existing failure channel.

An inner helper returns to its caller. It never invokes an enclosing helper to
perform an outer transition, which would create a recursive call cycle that
self-tail-call elimination cannot remove. The caller either resumes normal
work, returns the owning source-function value, or performs its own targeted
break/continue. Ordinary nested source functions own their returns.

The [shared return lift](./README.md#owning-returns-in-value-regions) runs before
memo and completion lowering. It exposes admitted owning returns in operands
while retaining earlier evaluations, selected lazy demands and exact transfer
ownership. A transfer cannot escape an operand's locally owned loop chain.
Standalone blocks never invent a source-function owner.

## Canonical root loops

[Canonical invocation roots](./loop/root/README.md) reuse the enclosing function
only for exact entry aliases, a matching invocation transition and one direct
public result. The established scalar form takes priority; general roots cover
zero through sixteen fixed parameters and optional observed rest without
changing public arity. One-time computation, retained entry values or following
result processing can require a separate helper.

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

The root resolver preserves statement regions for shared normal/control
joins. The following graph is constructed once and shared across normal exits,
as it is for noncanonical helper callers. Terminal public results and self calls
remain direct, without a continuation function or eager completion payload.

The `sharedRootJoinGrowth` [proof](./proof.f.mjs) includes fixed invocation
inputs, a captured value, simultaneous next-state updates and a required suffix
call/allocation. Its normalized FAST size and unique graph-node count have
bounded linear growth as the number of mixed regions increases.

Every size has one suffix call and allocation, one direct self call and one
function. Existing exact graph fixtures remain unchanged; mixed result regions
bind selected normal values through the graph join rather than per-arm suffix
definitions.

Normalized loop bodies already have explicit transfers and no implicit
fallthrough. A reached loop-body `yield` violates that precondition and is
refused, rather than being interpreted as a return or a new iteration.

## Member-resolution decision

Lifting argument control must preserve the lookup boundary. In
`null.f(argument-block-returning-7)`, lookup fails before that successful
return; calling an already evaluated noncallable value instead reaches the
arguments before callable validation. A nullish optional receiver skips its
key and arguments. A plain property read cannot express the optional-call
guard for native methods: it may yield undefined where a member call exists.

The internal query is `['memberPresent', receiver, key]`.
It returns the existing optional-member-call guard's Boolean result or the
lookup failure. A true result permits argument evaluation; callable validation
belongs to the subsequent call. The internal query is implemented across
schema, graph conversion, evaluation and target output. The shared FAST return
pass uses it to lift owning returns through member and optional-call operands.

The alternative considered was a first-class resolved-member value plus an
invocation form. It could retain one resolution across argument control, but would add a
value kind, identity and invocation contracts to the schema, runtime and
consumers. The Boolean query reuses the current member-call representation and
accepts repeated pure resolution. Revisit that choice only with evidence that
its lookup cost warrants the larger contract.

### Query contract

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

One shared resolver derived from
[`operations.property`](../operations/module.f.mjs) serves the existing call
and the query:

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

### Control and receiver preservation

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

### Accepted lookup cost

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

### Backend reconciliation

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

### Evidence and verification

The query is supported end to end by closed schema/types, graph analysis and
identity, shared conversion and preparation, represented evaluation, JavaScript
and Rust output, and NaNVM. Shared member/runtime admission and capture/bootstrap
requirements stay aligned across those consumers. Internal FAST value regions
distinguish the following cases before target spelling:

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


## Spread boundary

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

## Identity and evidence

The [graph identity contract](./README.md#graph-identity-and-normalization)
names the exact EDAG → FAST → EDAG domain: canonical binding reads, captures,
required anchors and supported invocation roots. Other supported inputs retain
semantics and explicit sharing under their documented normalization, then
stabilize on repeated conversion. Removing a helper wrapper does not itself
promise the old graph identity. The short-circuit schema migration has its own
[graph compatibility policy](../README.md#source-logical-operators).

The construction proofs retain the delivered integration cases:

- [General helper and root proofs](./proof.f.mjs) cover state/result signatures,
  shared normal joins, scoped completion dispatch and bounded join growth.
- [Root matching](./loop/root/proof.f.mjs) pins positive and negative invocation
  forms, retained entry values, simultaneous transitions, rest recipes and arity.
- [Memo integration](./loop/memo/integration/proof.f.mjs),
  [initializer-owned cells](./initializer_loop_cells/proof.f.mjs),
  [deferred crossings](./deferred_loop_cells/proof.f.mjs) and
  [eager operand planning](./eager_operand_memo/proof.f.mjs) pin declaration,
  caller, iteration and recipe lifetimes with their shared identities.
- [Owning returns](./lazy_returns/proof.f.mjs),
  [capture returns](./capture_returns/proof.f.mjs),
  [entry returns](./entry_returns/proof.f.mjs) and
  [transfer returns](./transfer_returns/proof.f.mjs) retain reached payloads,
  exact owners and skipped suffixes.
- [Member returns](./member_returns/proof.f.mjs),
  [normal memo members](./normal_memo_members/proof.f.mjs),
  [spread returns](./spread_returns/proof.f.mjs),
  [object spreads](./object_spread_returns/proof.f.mjs) and
  [normal memo spreads](./normal_memo_spreads/proof.f.mjs) distinguish lookup,
  conversion and expansion failure from a later successful return.

Pure callback counts are not semantic observations. Cost examples above are
implementation measurements; failure proofs pair a reached failure with a
later successful return so that both outcomes cannot satisfy the same case.
