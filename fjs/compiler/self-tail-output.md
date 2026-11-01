# Self-tail output conformance

The output requirement is bounded-stack execution for eligible self-tail
evaluations, including those transported through generated helpers. JavaScript
output must use `while`; it cannot depend on engine tail-call optimization.
Rust consumes the same loop plan. Ordinary non-tail calls and observable self
identity retain their meaning.

This audit records the existing profiles and final native witnesses, including
independent shared terminal recipes. Its evidence covers the named profiles;
broader source-admission and direct-preparation boundaries remain below.
Explicit source returns remain required.

## Routes and owner boundaries

| Final output | Entry and shared stages | Native evidence |
| --- | --- | --- |
| Public FJS modules | [`tryStringify` / `tryModuleStringify`](serializer/module.f.mjs): identity analysis and admission, `fromAnalysis`, source-loop coordination, source preparation, JS rendering. Marked output shares the spelling. | [Control-flow corpus](serializer/value/control_flow.proof.mjs), [owning returns](serializer/value/owning_tail_calls.proof.mjs), [deferred returns](serializer/value/deferred_tail_calls.proof.mjs). Output is reparsed as FJS before native execution. |
| Code-only JS modules | [`fromAnalysis`](../edag/to_fast/module.f.mjs), default common preparation and runtime JS rendering. | The same owning/deferred corpora execute this route separately from public source. |
| Function text | [`tryFunctionText` / `functionText`](serializer/module.f.mjs): admitted identity table, `functionFromAnalysis`, `prepareFunction`, JS function rendering. Captures are external positions rather than evaluated initializers. | [Function-text corpus](serializer/function_text/proof.mjs), including deep scalar, argument-count, spread/rest, setup and generated-helper cases. |
| Evaluated-value JS modules | [`stringify` / `factoryStringify`](serializer/value/module.f.mjs): evaluated value, identity analysis, `fromAnalysis`, default preparation and runtime rendering. | [Runtime-value proofs](serializer/value/proof.mjs): `zeroInputSourceTailLoopsKeepInvocationSnapshots`, `multiInputSourceLoopsKeepIterationSnapshots`, `branchingTailCallsKeepSelectedArgumentsAndInvocationSnapshots`. |
| Rust | [`toRust`](rust/module.f.mjs) and [EDAG Rust adapter](../edag/rust/module.f.mjs): graph admission, common conversion/preparation, [prepared Rust renderer](../rust/serializer/module.f.mjs). | [Ordinary loops](../../nanvm/harness/tests/while_loop.rs), [owning returns](../../nanvm/harness/tests/owning_self_tail_calls.rs), [deferred returns](../../nanvm/harness/tests/deferred_owning_tail_calls.rs). |

Tail status belongs to an evaluation and its owning function. A selected
conditional result or final sequence operand can be tail; a test, capture,
ordinary operand or read of a completed call is not made tail by later return.
Ordinary nested functions own their self calls. The shared
[tail planner](../edag/to_fast/tail/module.f.mjs) and
[invocation transitions](../js/ast/invocation/module.f.js) own these decisions;
the target writers consume their prepared control flow.

## Conformance witnesses

The existing suites already exercise ordinary scalar tails up to one million
transfers and owning/helper-mediated tails at 100,001. These depths are witnesses
for the named profiles, not portable maximums for ordinary recursion.

| Profile | Witness and observable contract |
| --- | --- |
| Direct and conditional tails; final sequence work | [Function text](serializer/function_text/proof.mjs), `loops`, `tailArgumentCounts`, `spreadTailArguments`; [graph proofs](../edag/to_fast/tail_calls/proof.f.mjs), `finalCommaPrefixesRunAtTheirOriginalIterations`. Reached arguments and failures finish before simultaneous updates. |
| Owning returns across real loop helpers | [Native JS](serializer/value/owning_tail_calls.proof.mjs), `terminalLoopTailReturnsSwapOneInvocationSnapshot`, `ordinaryLoopTailReturnsRestartLocalsAndRetainEscapedSnapshots`, `nestedLoopsKeepInnerBreakAndContinueTargets`; [function text](serializer/function_text/proof.mjs), `generatedLoopHelpersKeepDeepFunctionTextExecution`; [Rust owning tests](../../nanvm/harness/tests/owning_self_tail_calls.rs). Local state restarts and exact return/loop owners survive. |
| Immutable aliases of owning self | [Native JS](serializer/value/owning_tail_calls.proof.mjs), `immutableSelfAliasesRetainTailOwnershipAcrossLoopHelpers`; [deferred JS](serializer/value/deferred_tail_calls.proof.mjs), `owningTailsSurviveDirectNestedAndAliasedDeferredRecipes`; [Rust deferred tests](../../nanvm/harness/tests/deferred_owning_tail_calls.rs), `deferred_owning_returns_run_deeply_through_loops_and_aliases`. |
| Memo getters and deferred owning tails | [Native JS](serializer/value/deferred_tail_calls.proof.mjs) and [function text](serializer/function_text/proof.mjs), `deferredOwningReturnsKeepTheirFunctionTextTailTransfers`, execute the existing deferred fixtures, including the source-refused `nestedRecipe` and `normalPayload`. Completion forwarding keeps the owning transition outside the getter; required/skipped argument work, captures and opaque normal payloads retain their meaning. |
| Rest, captures and allocation lifetime | [Function text](serializer/function_text/proof.mjs), `restTailInvocations`, `defaultAndDestructuringTailSetup`; [Rust deferred tests](../../nanvm/harness/tests/deferred_owning_tail_calls.rs), `rest_snapshots_stay_shared_within_one_invocation`, `captures_keep_their_creating_invocation`. Repeated reads share one invocation's allocation; new invocations and rest slices remain fresh. |
| Mixed tail/non-tail uses and self as a value | [Graph proofs](../edag/to_fast/tail_calls/proof.f.mjs), `nonTailSelfValuesAndCallsRetainTheirFunctionBinding`, `restTailLoopsKeepRemainingSelfIdentityAndNonTailCalls`; [function-text corpus](serializer/function_text/proof.mjs), `mixedSelfUsesKeepExternalCapturesAndFollowingOrdinaryWork`; [native Rust](../../nanvm/harness/tests/mixed_self_uses.rs). The shared graph keeps ordinary-call work and public function identity alongside deep tail transfers. |
| Immutable continuations | [Source readback](serializer/value/immutable_source_joins.proof.mjs), [graph output](../edag/to_fast/immutable_invocation.proof.mjs). These acyclic helpers preserve owning returns, sharing and captures; they are not recursive-loop witnesses. |

## Independent shared terminal recipes

The identity-sensitive [shared fixtures](../edag/to_fast/tail/fixtures.f.js)
reuse each terminal call object across several decision leaves. Common planning
walks that decision tree once to produce a private recipe index, then dispatches
to one physical continuation per recipe. Reached base results and abrupt exits
complete the invocation before dispatch. Required prefix work and nonexclusive
shared dependencies keep their common scope; exclusive dependencies remain in
their selected recipe. The existing single-root continuation keeps its layout.

[Pure planner proofs](../edag/to_fast/tail/proof.f.mjs) verify shared physical
regions, required order and dependency scope. The
[native JavaScript proofs](serializer/value/independent_tail_recipes.proof.mjs)
execute code-only modules, evaluated-value modules and function text at 100,001
transfers. The [native Rust tests](../../nanvm/harness/tests/independent_tail_recipes.rs)
use the same graphs. Distinct argument vectors, selected ignored-argument
failures, shared allocations and escaped readers retain their original meaning.

The [shared normal-result rewrite](../js/ast/results/README.md) forwards the
selector wrapper's result into its sole conditional, preserving branch scopes
and transfer owners. Public FJS source now emits the scalar, vector and selected
failure profiles. Native proofs parse, execute and reserialize each profile
through two source generations, including 100,001 transfers, opaque arguments,
fresh result arrays and skipped/reached failures. These are semantic readback
guarantees, without a graph/hash fixed-point requirement.

The snapshot graph retains genuine lazy placement and its explicit source
refusal. Arbitrary statement blocks and broader nonlocal source profiles remain
outside the forwarding rule.

## Remaining boundaries

### Source refusals and recursive reconstruction

The deferred fixtures `nestedRecipe` and `normalPayload` are explicit public
source refusals because genuine lazy placement remains. General JS and Rust
execute their owning tails deeply. They remain source-admission gaps; see
[general source profiles](../edag/to_fast/source/loops/todo/general-source-profiles.md).

The source coordinator's
[`recursiveFunction` / `resultBlock`](../edag/to_fast/source/loops/module.f.mjs)
can reconstruct a canonical invocation as a recursive function outside retained
loop profiles. Non-reifiable layouts return an explicit error. Existing fallback
proofs include one-pass owning-value returns; they do not establish a deep
recursive final-output witness. This audit found no independently confirmed
accepted recursive public-source example and makes no universal bounded-stack
claim for that fallback.

### Direct FAST preparation

Direct `prepareFunction` is a separate lower-level route: it does not replace
the graph tail planner. The existing
[`rawAndGraphPreparationRetainArityCapturesAndSelfOwnership`](../edag/to_fast/tail_calls/proof.f.mjs)
and
[`graphRecoveryKeepsItsSeparateBoundaryAndOwningSelfTailLoop`](../js/ast/prepare/immutable_joins.proof.mjs)
show raw FAST retaining self calls while equivalent graph conversion emits a
loop. Producers using direct preparation must already supply planned loops;
the graph-route evidence cannot be attributed to that direct entry point.

## Mixed self uses across native targets

The shared [`_mixedSelfUses()` fixture](../edag/to_fast/tail/fixtures.f.js)
combines a tail self call above count one, one ordinary `self(0)` call at count
one, and a base array containing captures and the original public `self`.
The ordinary call node is shared by both elements of its following result
array. The [pure proof](../edag/to_fast/tail/mixed_self.proof.f.mjs) checks this
actual node identity and shallow semantic observations.

JavaScript function text and [native Rust](../../nanvm/harness/tests/mixed_self_uses.rs)
both execute this graph with input 100,001. Returning the following pair
preserves ordinary-call work; both elements reference its one result allocation.
The returned self equals the original public function, and new invocations
create fresh outer and inner result arrays while sharing the function's capture
array. Public arity remains one.

The Rust generator evaluates the closed graph captures `7, [], 9`. The existing
function-text test deliberately supplies external slots `17, [19], 29`, proving
the code-only API uses the supplied capture positions rather than evaluating
the graph's initializer literals. These are separate capture-entry contracts
over the same function body.
