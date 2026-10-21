## General loops and tail calls

**Priority:** P2
**Status:** open — coordination epic; implementation has not started

### Goal

Allow ordinary local rebinding and structured loops, and emit eligible tail
self-calls as loops. Build these features on FAST and the common conversions.
FAST describes execution steps; EDAG describes the requested result and its
value dependencies. The architecture owner defines their semantic contracts.
Simplicity and separation of concerns govern both the architecture and the
order of work.

**Implement the foundation first.** Migrate the currently supported language
through AST -> FAST -> EDAG and EDAG -> FAST -> target before adding the new
features. Do not implement short-circuit normalization, general rebinding or
broader loop recognition in the old fold/writers and later port them to FAST.

The current language remains the [restricted loop form](../../spec/control-flow/loops/README.md)
until the corresponding source milestone is complete.

### Owners

This file owns scope, implementation order and integration gates. Each rule
has one detailed owner; implementations and other TODOs link there.

| Concern | Authoritative proposal |
| --- | --- |
| FAST vocabulary, shared binding analysis, stage invariants, preparation and baseline migration | [Compiler architecture](./compiler-vocabulary-and-modularization.md#fast-contract) |
| Mutable bindings and source loop admission/normalization | [Let proposal: later work](../../spec/todo/3220-let.md#later) |
| Explicit FAST loops to recursive EDAG; state/completion encoding and root-loop reuse | [FAST loop construction](../edag/todo/fast-loop-construction.md) |
| Existing output migration and broader tail-call analysis | [Tail-call loops](../edag/todo/tail-call-loop.md) |
| Logical operators to conditionals and EDAG schema migration | [Short-circuit conditionals](../edag/todo/short-circuit-conditionals.md) |

Source name/declaration checks preserve legality before declaration kinds are
discarded. Pattern expansion precedes shared local/parameter write analysis;
source capture admission precedes assignment normalization and helper creation.
FAST normalization determines branch results and loop inputs/results.
`from_fast` consumes those explicit signatures; it does not inspect source
`let`, classify source writes or rediscover loop state. Serializers render
common prepared FAST.

### Implementation order

Work in the order below. The dependencies include deliberate delivery gates:
finish the shared foundation before extending behavior, and finish the loop
conversion machinery before admitting the broader source forms. Independent
research does not justify landing a feature in a temporary owner.

A milestone may take several small PRs. Move existing implementations into
their final owners, update consumers with each move, and retire each replaced
path in the same increment. A new representation lands with its first real
consumer. This order does not require a single large migration PR or unrelated
tokenizer/directory cleanup.

| ID | Deliverable and owner | Depends on | Completion gate |
| --- | --- | --- | --- |
| A | Define and implement the [FAST contract](./compiler-vocabulary-and-modularization.md#fast-contract) | Existing AST/EDAG evaluation contracts | Shared bindings with inferred `isMutable`, write/capture analysis, normalized/prepared forms, graph domains and pass APIs are concrete; the first existing consumer uses them. |
| B | Migrate existing source input through FAST; architecture and loop-construction owners | A | Current source admission survives; `from_fast` supports existing scalar loops and scalar root-loop reconstruction required by C, under A's explicit graph contracts. |
| C | Migrate existing output through FAST; architecture and [tail-loop migration](../edag/todo/tail-call-loop.md#fast-migration) owners | B | Source JS, runtime/function text and Rust use shared placement/preparation; existing stack-safe, capture, failure and round-trip cases pass; replaced writer analysis is removed. |
| D | Desugar short-circuit operators and remove their EDAG tags; short-circuit owner | C | Lowering lives in AST-to-FAST; canonical producers/consumers and the explicit old-graph policy agree. |
| E | Generalize explicit FAST loops to EDAG; loop-construction owner | D | Arbitrary structured placement, explicit state/results, enclosing-function returns and root-loop rules work on normalized FAST fixtures. |
| F | Generalize tail-call analysis and common loop emission; tail-call owner | E | Eligible evaluations become simultaneous loop transitions with complete invocation/capture lifetimes; generated loop helpers remain stack-safe. |
| G | Admit general local rebinding and write-based capture rules; language owner | F; formal language-design approval | Source policy uses A/B's shared analysis; value/branch-result lowering uses the established FAST path, with explicit compatibility migration. |
| H | Admit general source loops and exits; language owner | G | Sequential, conditional and nested loops, break/continue/return/throw work through the complete shared pipeline. |
| I | Finish integration and close the epic | H | Public contracts and examples describe shipped behavior; all replaced paths and completed TODOs are reconciled. |

A-C are the foundation gate. Preserve current behavior while changing its
owner; shared binding analysis does not enable G's new source capture policy.
D-H implement new behavior only through that foundation.

E-F develop the general internal conversions using explicit FAST/EDAG fixtures;
they do not prematurely enable source spellings the parser cannot read.
EDAG -> normalized FAST -> EDAG can be checked directly. Broader source
loop output is connected when H admits its grammar, using the same conversion
and serializers rather than a temporary output path. Existing public output
continues to satisfy its supported grammar and round-trip contracts throughout.

### Tasks

- [ ] **A — FAST first.** Implement the architecture owner's small common model
      and stage APIs. Resolve representation questions there before consumers
      depend on them; include uniform local/parameter binding analysis, branch
      results, loop signatures and shared lazy evaluation, not just renamed
      AST types.
- [ ] **B — Existing input.** Move source checks and lowering to their final
      owners. Preserve scopes, diagnostics, captures, arity, required evaluations
      and established single-variable loop cases. Implement scalar root-loop
      reconstruction needed by C now; resolve any graph-normalization contract
      explicitly in A/B rather than introducing a temporary output exception.
- [ ] **C — Existing output.** Move graph placement and current tail-loop
      decisions to `to_fast`; establish common emission preparation and migrate
      every required consumer before starting D.
- [ ] **D — Smaller EDAG.** Complete the short-circuit owner's source lowering,
      schema/identity decision and producer/consumer migration.
- [ ] **E — General graph construction.** Complete the loop-construction owner
      using explicit FAST inputs/results; no source-mutability analysis here.
- [ ] **F — General tail calls.** Complete the tail-call owner's evaluation-aware
      eligibility and invocation preparation. Prove bounded stack use for the
      helper shapes E constructs, including repeated nested loops.
- [ ] **G — General bindings.** Implement the language owner's admission and
      AST-to-FAST rules after approval using the existing analysis; migrate the
      post-loop and immediate-call capture exceptions for reassigned bindings
      to explicit snapshots.
- [ ] **H — General source loops.** Connect source state/result selection and
      transfer resolution to E/F. Admit and emit each new source form only with
      its complete conversion path and evidence.
- [ ] **I — Close.** Move final contracts to their README/JSDoc/spec owners,
      preserve decisions and inbound links, and delete completed task files.
      Documentation and obsolete-path removal accompany earlier steps too.

### Integration evidence

Detailed cases belong to the owners above. The epic's cross-boundary gates are:

| Gate | Evidence |
| --- | --- |
| Existing language through FAST | Current source acceptance, required failures, eager/lazy sharing, function arity, captures, function text and existing million-round cases survive A-C. |
| Smaller canonical EDAG | Source short-circuit semantics and operand identity survive D; former tags follow the explicit admission/hash policy. |
| Internal loop conversions | E-F preserve explicit state, normal completion and enclosing-function return; repeated conversions stabilize within the declared graph domain. |
| Source semantics | G-H apply one write-based capture rule to locals and parameters, including destructured bindings, before optimization; preserve lexical scope, TDZ, condition re-evaluation and required overwritten initializers. |
| Loop execution | Following code runs once on normal completion; nested helpers return to callers; iteration count does not increase stack depth. |
| Invocation and output | Simultaneous argument updates, rest/default/spread behavior, per-invocation values and snapshots agree across the shared JS/Rust path. |

Labels, other loop syntaxes, mutual-recursion elimination, general
trampolining, a general CFG and global liveness optimization are outside this
epic. Mutable object contents remain the separate
[mutability design](../../spec/design/mutability.md).

### Design record

The [originating session](https://chatgpt.com/c/6ad8c457-d2cc-83e8-a37f-ab7f4e603e0e)
records the request for simplicity, separate responsibilities and FAST-first
implementation. This ordering supersedes the earlier allowance to implement
new features in the current frontend or writers and move them afterward.

This PR records a plan, not compiler behavior. The language proposal owns
formal approval under
[DESIGN.md section 12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions);
the original single-variable approval does not authorize the broader source
semantics.
