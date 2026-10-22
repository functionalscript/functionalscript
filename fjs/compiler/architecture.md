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
| `js/ast/prepare` | Common temporaries, slots, simultaneous transfers and invocation lifetimes. |
| `js/ast/serializer`, `rust/serializer` | Prepared FAST rendered in target syntax. |
| `text/marked` | Language-independent marked text and demarking. |

The table names final owners. Migration is incremental: the
[implementation epic](../todo/general-loops-and-tail-calls.md) records which
existing paths have moved. A replaced path is retired with its consumers;
adding a new feature to a path scheduled for replacement is not a migration.

## Stage invariants

Source name resolution and syntax/declaration checks precede expansion that
erases their evidence. Pattern and default expansion preserve binding identity
and function arity. One complete write/capture analysis then classifies both
parameters and locals. Initialization is distinct from reassignment; nested
and unreachable writes still count. Analysis reports facts, and source
admission applies the current capture policy before generated helpers exist.

Normalized FAST has immutable values and explicit branch results, loop inputs,
loop results and resolved transfers. A value-producing block has no function
or invocation boundary. Required initializers remain required even when their
values are overwritten or discarded. A shared lazy value is established on
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
equality. The [FAST contract](../todo/compiler-vocabulary-and-modularization.md#fast-contract)
and [loop construction contract](../edag/todo/fast-loop-construction.md)
record stronger domains as their implementations land. A schema migration
creates a new graph identity; it cannot retain an old content hash merely
because behavior is equivalent.

Plain target output is the demarked marked output. Runtime function text has
its additional [public contract](../edag/function-text.md). Target-specific
literal and runtime operation spelling remains with the target, while
semantic placement and invocation lifetimes have a single common owner.
