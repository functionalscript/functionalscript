## General loops and tail calls

**Priority:** P2
**Status:** wip — A-G shared construction, tail calls and general bindings
implemented; general source loops remain in H

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

The [loop specification](../../spec/control-flow/loops/README.md) records the
source forms delivered by each H increment.

### Owners

This file owns scope, implementation order and integration gates. Each rule
has one detailed owner; implementations and other TODOs link there.

| Concern | Authoritative proposal |
| --- | --- |
| FAST vocabulary, shared binding analysis, stage invariants, preparation and baseline migration | [Compiler architecture](./compiler-vocabulary-and-modularization.md#fast-contract) |
| Mutable bindings and source loop admission/normalization | [Let proposal: later work](../../spec/todo/3220-let.md#later) |
| Explicit FAST loops to recursive EDAG; state/completion encoding and root-loop reuse | [FAST loop construction](../edag/todo/fast-loop-construction.md) |
| Existing output migration and broader tail-call analysis | [Tail-call loops](../edag/todo/tail-call-loop.md) |
| Logical operators to conditionals and EDAG schema migration | [Short-circuit conditionals](../edag/README.md#source-logical-operators) |

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
conversion machinery before admitting the broader source loop forms —
general bindings, which keep the loop as it is, need the foundation alone.
Independent research does not justify landing a feature in a temporary owner.

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
| G | Admit general local rebinding and write-based capture rules; language owner | D; formal language-design approval | Source policy uses A/B's shared analysis; value/branch-result lowering uses the established FAST path, with explicit compatibility migration; loops stay the admitted single-variable form. |
| H | Admit general source loops and exits; language owner | F, G | Sequential, conditional and nested loops, break/continue/return/throw work through the complete shared pipeline. |
| I | Finish integration and close the epic | H | Public contracts and examples describe shipped behavior; all replaced paths and completed TODOs are reconciled. |

A-C are the foundation gate. Preserve current behavior while changing its
owner; shared binding analysis does not enable G's new source capture policy.
D-H implement new behavior only through that foundation.

E-F develop the general internal conversions using explicit FAST/EDAG fixtures;
they do not prematurely enable source spellings the parser cannot read.
G does not wait for them: its loops stay the single-variable form the scalar
construction already handles, and an assignment outside a loop lowers to a
fresh value or a branch result through the path D established, so G's only
technical dependency is the foundation. It was ordered after F so that no
feature landed in a temporary owner; with A-D in their final owners that
reason is spent, and the first refusal of three of the five remaining
authored `.f.mjs` leaves is a binding or loop form G or H admits — a
pattern after `let`, a `return` inside a loop, an assignment inside a loop's
branch
([the leaf table](../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point));
the other two wait on `new Map` and `for`, outside this epic, and
`types/list` holds generators behind its loops. G is H's dependency. H keeps
both dependencies: its loops need E's general helpers and F's emission.
EDAG -> normalized FAST -> EDAG can be checked directly. Broader source
loop output is connected when H admits its grammar, using the same conversion
and serializers rather than a temporary output path. Existing public output
continues to satisfy its supported grammar and round-trip contracts throughout.

### Tasks

- [x] **A — FAST first.** Implement the architecture owner's small common model
      and stage APIs. Resolve representation questions there before consumers
      depend on them; include uniform local/parameter binding analysis, branch
      results, loop signatures and shared lazy evaluation, not just renamed
      AST types.
- [x] **B — Existing input.** Move source checks and lowering to their final
      owners. Preserve scopes, diagnostics, captures, arity, required evaluations
      and established single-variable loop cases. Implement scalar root-loop
      reconstruction needed by C now; resolve any graph-normalization contract
      explicitly in A/B rather than introducing a temporary output exception.
- [x] **C — Existing output.** Move graph placement and current tail-loop
      decisions to `to_fast`; establish common emission preparation and migrate
      every required consumer before starting D.
- [x] **D — Smaller EDAG.** Complete the short-circuit owner's source lowering,
      schema/identity decision and producer/consumer migration.
- [x] **E — General graph construction.** Complete the loop-construction owner
      using explicit FAST inputs/results; no source-mutability analysis here.
      Fixed-input invocation roots and nested normal-exit aggregate helpers are
      implemented, along with statement-level function returns and outer-loop
      transfers. Helper callers and canonical invocation roots share normal
      continuations at graph construction. Memo cells preserve caller, iteration
      and initializer lifetimes through nested normal-exit helpers and owning
      source-function returns and outer-loop transfers. Direct plain value
      regions, eager unary/binary and `instanceof` operands, conditional tests,
      plain calls, non-spread arrays/objects, comma sequences, statement result
      lists, value-region result packing and member/optional-call operands can
      lift owning returns. The shared `memberPresent` query retains lookup and
      receiver semantics; optional skips and forced-call continuations preserve
      selected memo state. Array/call and object spreads materialize before
      later control; object keys convert before values. Closure capture
      expressions retain construction order and the enclosing return owner,
      while nested bodies keep their own function boundary. Break and continue
      payloads retain evaluation order, exact targets and simultaneous state
      updates while exposing owning returns. Loop-entry initializers expose
      owning returns in enclosing scope before the loop starts, preserving
      ordered one-time setup and caller/iteration memo lifetimes. Native callees
      and their wrappers admit argument returns while retaining callee reads
      before arguments. Wrapped member callees retain selected property reads
      before arguments and detached invocation. Lazy initializer returns
      propagate at selected first demands through shared recipe completions,
      preserving memo lifetimes. Cells declared in initializer-owned loops
      reset at reached declarations, share within their iteration and nested
      loops, retain captured values, and propagate source-owned returns.
      Normal-only memo plans also sequence member and optional calls, preserving
      optional skips, lookup order, receivers and shared cell lifetimes.
      Standalone array/call/object spreads and object entries retain reached
      expansion, copying and key-conversion order. Prepared declaration and loop
      occurrences expose cells owned entirely inside operands while preserving
      function and deferred-initializer boundaries.
      Caller and initializer planning also share an eager lexical inventory for
      operand loops and computed lazy locals, retaining caller sharing, fresh
      local lifetimes and separate transfer ownership.
      Deferred-initializer helper crossings select their caller-owned cells
      even without an eager caller loop, preserving declaration-time scope and
      first-demand evaluation through nested recipes.
- [x] **F — General tail calls.** Complete the tail-call owner's evaluation-aware
      eligibility and invocation preparation. Prove bounded stack use for the
      helper shapes E constructs, including repeated nested loops.
      Fixed-parameter tail evaluations in either conditional arm and final
      sequence operands now use canonical invocation loops. Simultaneous updates,
      captures, per-iteration lifetimes and stable graph conversion are proven,
      including deep JavaScript/Rust execution of repeated nested E helpers.
      Missing and extra spread-free recursive arguments preserve required
      evaluation and simultaneous state updates. Spread arguments expand before
      transitions through the same private invocation array. Observed rest uses
      a fresh array each invocation while preserving sharing, captures and
      lowered default/destructuring setup. Canonical rest recipes reconstruct
      original arguments without wrapper growth, including sixteen fixed
      parameters plus rest without changing public arity. H owns new source
      loop spelling.
- [x] **G — General bindings.** Implement the approved language owner's
      admission and AST-to-FAST rules using the existing analysis, including
      patterns after `let` and module variables. Write-based capture admission
      applies to locals and parameters before optimization, including
      destructured and shadowed bindings and unreachable writes. Held closures
      over reassigned bindings require explicit snapshots, including after a
      loop. Immediate-call reads remain admitted; nested writes stay refused.
      The language owner records compatibility and the proof evidence.
- [ ] **H — General source loops.** Connect source state/result selection and
      transfer resolution to E/F. Admit and emit each new source form only with
      its complete conversion path and evidence.
      Plain bodies now admit zero/multiple state values, sequential loops and
      loops in terminal guard/case blocks. Shared binding events select state;
      source JavaScript, code-only JavaScript and Rust execute eligible plain
      aggregate helpers with bounded stack. Shared preparation retains
      condition-only work and immutable final-result captures; the first source
      round trip establishes a stable normal form
      ([output contract](../edag/todo/tail-call-loop.md#remaining-general-source-output)).
      Module loops now reuse source loop resolution and state selection,
      preserving initialization order and named-export snapshots.
      Conditional statements inside loop bodies preserve assigned outer bindings
      through explicit FAST branch results, including unchanged values on the
      skipped arm and following body statements. Nested conditional blocks keep
      their lexical scopes. Existing shared loop output emits these branch
      computations with bounded stack.
      `else` and `else if` loop-body arms share explicit FAST results for the
      union of their outer writes, retaining preceding values in an arm that
      leaves a binding unchanged. Each arm retains its lexical region and only
      reached conditions and computations run.
      Nested `while` bodies, including loops in conditional arms, resume their
      enclosing statements with the inner results and fresh local initialization
      for every reached outer iteration. Existing shared source state selection
      and graph conversion retain their normal continuations and scopes.
      Unlabeled `break` and `continue` in loop bodies and conditional arms
      resolve the innermost loop and package current state through the existing
      FAST transfers. Reached work stays before an exit; following statements
      are skipped while their source legality and write facts are still checked.
      A continued loop retests its condition; a broken loop resumes following
      statements once. The next increment admits owning-function `return` and
      statement `throw` in loop bodies and conditional arms. Returns cross
      generated loop helpers but stay local to ordinary nested functions;
      both exits preserve reached work and skip following computations while
      retaining source legality checks. Switches remain a later increment.
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

The originating PR records the plan. The stacked implementation branches cover
the shared foundation, conditional schema and fixed-input root increment
without enabling the later source extensions. The language proposal owns
formal approval under
[DESIGN.md section 12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions);
the original single-variable approval does not authorize the broader source
semantics.
