# Compiler representations and passes

FAST describes execution steps. EDAG describes the requested result and its
value dependencies, including identity sharing, required evaluation and
conditional evaluation. Neither representation implies that a source program
is admitted by FunctionalScript.

The conversion boundaries are:

```text
JS text -> tokens -> source AST -> FAST -> EDAG
                                          |
                            EDAG optimization (optional)
                                          |
target text <- marked text <- tokens <- prepared FAST <- FAST
```

Parsing, source admission, desugaring, graph construction and optimization are
separate responsibilities. Convenience entry points may compose them.
Conversion does not recover source names or formatting.

| Owner | Responsibility |
| --- | --- |
| `js/tokenizer` | Lexical spelling, escapes and token separation. |
| `compiler/parser/syntax` | Source syntax, with tokens retained for diagnostics. |
| `compiler/parser` | Name resolution, declaration legality and current source admission. |
| `js/ast` | FAST bindings, stable identities, write/capture facts and stage contracts. |
| `js/ast/sugar` | Source sugar and normalization into immutable values and explicit control flow. |
| `edag/from_fast` | Graph construction from normalized FAST. |
| `compiler/source`, `compiler/edag` | Module loading, identity, linking and graph orchestration. |
| `edag/analysis`, `edag/sharing` | Graph identity, dependency and evaluation analysis. |
| `edag/to_fast` | Shared binding placement, evaluation regions and tail-loop recovery. |
| `js/ast/returns` | Owning-return lifting with ordered member resolution and optional continuations. |
| `js/ast/prepare` | Common temporaries, slots, simultaneous transfers and invocation lifetimes. |
| `js/ast/serializer`, `rust/serializer` | Prepared FAST rendered in target syntax. |
| `text/marked` | Language-independent marked text and demarking. |

The table names the shared owners used by source JavaScript, runtime function
text and Rust. Graph-aware placement, state and invocation analysis belong to
these passes; serializers consume their prepared decisions. The completed
[loop integration](#loop-integration) records the cross-boundary evidence.

## Stage invariants

Source name resolution and syntax/declaration checks precede expansion that
erases their evidence. Pattern and default expansion preserve binding identity
and function arity. One complete write/capture analysis then classifies both
parameters and locals. Initialization is distinct from reassignment; nested
and unreachable writes still count. Analysis reports facts, and source
admission applies the current capture policy before generated helpers exist.

Normalized FAST has immutable values and explicit branch results, loop inputs,
loop results and resolved transfers. A value-producing block has no function
or invocation boundary. Assignments in such a block export new immutable
binding versions to its continuation, including later operands. Conditional
regions join only the reached updates, and loop conditions carry their updates
through both true and false results. Required initializers remain required even
when their values are overwritten or discarded. A shared lazy value is established on
its first reached use within its owning invocation, preserving its identity.
Graph construction consumes these contracts without rediscovering source
mutability or selecting loop state.

Preparation lowers semantic transfers to target-ready slots and temporaries.
It establishes all next values before changing state, preserves immutable
iteration values in captures and resets invocation-local memo storage at each
new invocation. Serializers spell these decisions without repeating graph
placement, capture analysis or parallel-update analysis.

## Graph and output contracts

References to one binding denote one value. Distinct equal allocations and
function constructions remain distinct. Conditional evaluation does not make
an earlier required initializer optional. A lazy-only dependency stays in the
region where it can be reached.

Exact graph round trips are claimed only for explicitly supported canonical
forms before physical preparation. Existing source-output fixtures compare
the graph's analysis-normalized form; their redundant-anchor removal and
permitted splitting of non-minting lazy expressions are not raw identity
equality. References canonicalize invocation reads to one node per binding;
primitive or equivalent duplicate capture slots can compact. These declared
normalizations can change graph bytes and hashes. Unused nonprimitive captures
remain eager. The [FAST contract](../todo/compiler-vocabulary-and-modularization.md#fast-contract)
and [loop construction contract](../edag/from_fast/loops.md)
record the supported identity and normalization domains. A schema migration
creates a new graph identity; it cannot retain an old content hash merely
because behavior is equivalent.

Plain target output is the demarked marked output. Runtime function text has
its additional [public contract](../edag/function-text.md). Target-specific
literal and runtime operation spelling remains with the target, while
semantic placement and invocation lifetimes have a single common owner.

## Loop integration

The general loops and tail calls implementation uses the shared pipeline above.
Source admission, loop construction, tail recovery and target preparation keep
their separate owners. The integration gates are covered by the following
proofs; the proof keys name the relevant cases within each linked file.

| Gate | Shipped contract and evidence |
| --- | --- |
| A: FAST and binding facts | [AST proofs](../js/ast/proof.f.mjs), `bindings.wholeScope`, and [control proofs](../js/ast/control/proof.f.mjs), `lexicalResults`, cover binding identities, writes/captures and explicit results. |
| B: Source input | [Parser bindings](parser/bindings.proof.f.mjs), `completeSourceScan`, [sugar](../js/ast/sugar/proof.f.mjs), `generalLoopStateUsesDeclarationOrderAndSharedWriteFacts`, and [construction](../edag/from_fast/proof.f.mjs), `bindingIdentityAndOrder`, preserve source facts before graph construction. |
| C: Shared output | [Conversion](../edag/to_fast/proof.f.mjs), `identities` and `regions`, preserves sharing and placement; [function text](serializer/function_text/proof.mjs), `loops`, and [Rust](../../nanvm/harness/tests/while_loop.rs), `a_million_rounds`, cover bounded-stack execution. |
| D: Logical lowering | [Logical sugar](../js/ast/sugar/logical/proof.f.mjs), `immutableLeftIdentity` and `originalLazyRegions`, retains lazy operands; [schema proofs](../edag/proof.f.mjs), `formerLogicalTags`, refuses retired graph tags. |
| E: Structured construction | [Construction proofs](../edag/from_fast/proof.f.mjs), `generalLoopRoundTrips`, `nestedLoopSequentialResults` and `loopReturnsKeepSourceFunctionOwnership`, cover explicit state/results and completion ownership; [root proofs](../edag/from_fast/loop/root/proof.f.mjs), `aliasFrameAndWideInvocation`, cover invocation-root reuse. |
| F: General tail calls | [Tail-call proofs](../edag/to_fast/tail_calls/proof.f.mjs), `swappedAndDependentArgumentsReadOneOldParameterSnapshot`, `loweredRestParameterSetupRunsAgainEachIteration` and `sharedLazyValuesResetOncePerIterationAndFreshInvocation`, cover simultaneous arguments, rest/default setup and invocation lifetimes. |
| G: Rebinding and captures | [Binding admission](parser/bindings.proof.f.mjs), `destructuredParameterWritesAndCaptures`, `shadowedNamesKeepTheirOwnWriteClassification` and `unreachableWritesStillPreventEscapingCaptures`, applies one write-based capture rule before optimization. |
| H: General source loops and exits | [Source-loop proofs](../edag/to_fast/source/loops/proof.f.mjs), `sourceFunctionExitsKeepTheirOwnersAndFirstParseFixedPoints`, `sourceLoopTransfersKeepStateAndFirstParseFixedPoints` and `nestedSourceLoopsRetainResultsAndStableSpelling`, cover owning returns, transfers, nested loops and graph/text normalization; the first two include eighteen state values. |
| I: Contracts and follow-ups | Permanent [source bindings](../../spec/bindings/variables/README.md), [source loops](../../spec/control-flow/loops/README.md), [construction](../edag/from_fast/loops.md) and [source output](../edag/to_fast/source/loops/README.md) own the delivered behavior and its explicit boundaries. |

The source gate also includes initially false and failing conditions, continue
retests, both conditional arms, sequential/module loops and following code.
[Loop-exit proofs](parser/loop_exits.proof.f.mjs),
`conditionRetestsAndEarlierWorkRemainRequired`, [module-loop proofs](parser/module_loops.proof.f.mjs),
`snapshotsSequentialAndZeroState`, and [switch proofs](parser/loop_switches.proof.f.mjs),
`labelsAndDiscriminantsRetainReachedEvaluation`, pin those paths. The
[native source-output proofs](serializer/value/proof.mjs),
`explicitThrowRootsKeepOrderIdentityAndBoundedStack`, observe deep transitions,
reached failures, fresh rest arrays and held iteration captures after later calls.

The first source parse may establish the documented scalar-helper normalization;
subsequent graph/text cycles are exact within the declared domain. Internal
construction has its own [identity and normalization contract](../edag/from_fast/README.md#graph-identity-and-normalization).
Neither statement promises raw graph equality for every supplied graph.

The original [design session](https://chatgpt.com/c/6ad8c457-d2cc-83e8-a37f-ab7f4e603e0e)
records the separation of responsibilities and foundation-first order. The
[language approval record](../../spec/bindings/variables/README.md#design-approval)
preserves the designer's separate approval of general bindings and loops.

### Remaining boundaries

The [canonical source-profile follow-up](../edag/to_fast/source/loops/todo/general-source-profiles.md)
tracks supplied FAST/EDAG forms that still need recursive source fallback or an
explicit refusal. Those active compatibility paths remain in the source adapter;
they are not replaced writer implementations. The established scalar recognizer
also remains in common conversion to preserve its graph and output shape.

Labels, additional loop syntax such as [for](../../spec/todo/3270-for.md),
mutual-recursion elimination, general trampolining, a general CFG, global liveness
optimization and [mutable object contents](../../spec/design/mutability.md) are
separate work. The [compiler vocabulary issue](../todo/compiler-vocabulary-and-modularization.md)
retains independent lexical API and ownership alignment tasks.
