# Self-tail output conformance

The output requirement is bounded-stack execution for eligible self-tail
evaluations, including those transported through generated helpers. JavaScript
output must use `while`; it cannot depend on engine tail-call optimization.
Rust consumes the same loop plan. Ordinary non-tail calls and observable self
identity retain their meaning.

This audit records the existing profiles and final native witnesses. It does
not establish a guarantee for every supplied graph: the independent terminal
recipe case below still emits recursion. Explicit source returns remain required.

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
| Mixed tail/non-tail uses and self as a value | [Graph proofs](../edag/to_fast/tail_calls/proof.f.mjs), `nonTailSelfValuesAndCallsRetainTheirFunctionBinding`, `restTailLoopsKeepRemainingSelfIdentityAndNonTailCalls`; [function-text corpus](serializer/function_text/proof.mjs), `mixedSelfUsesKeepExternalCapturesAndFollowingOrdinaryWork`. Only eligible tail evaluations become transfers; ordinary calls keep following work and the public function retains its identity. |
| Immutable continuations | [Source readback](serializer/value/immutable_source_joins.proof.mjs), [graph output](../edag/to_fast/immutable_invocation.proof.mjs). These acyclic helpers preserve owning returns, sharing and captures; they are not recursive-loop witnesses. |

## Remaining boundaries

### Independent shared terminal recipes

Two independent shared terminal call recipes currently retain recursion in
accepted code-only JS, evaluated-value JS and function text. The finite
[reproducer and follow-up](../edag/to_fast/tail/todo/independent-terminal-recipes.md)
returns `0` at shallow depths but overflows the native JS stack at 100,001 calls.
Rust accepts the graph and emits owning calls in memo initializers; native Rust
overflow was not measured. Public FJS source explicitly refuses this graph.

The [pure planner proof](../edag/to_fast/tail/proof.f.mjs),
`independentInterleavedRecipesKeepTheirExistingLayout`, records the narrower
single-root factoring capability. It does not prove the retained recursion
stack-safe. The follow-up must extend common planning while preserving selected
demand, sharing and per-invocation lifetimes.

### Source refusals and recursive reconstruction

The deferred fixtures `nestedRecipe` and `normalPayload` are explicit public
source refusals because genuine lazy placement remains. General JS and Rust
execute their owning tails deeply. They are source-admission gaps, distinct
from the accepted recursive output above; see
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

Rust's current native fixtures cover owning/deferred tails and shallow non-tail
self calls. They do not establish the exact mixed tail/non-tail plus observable
self-as-value combination covered by JavaScript function text. Keep that missing
native witness visible when extending the shared fixture corpus.
