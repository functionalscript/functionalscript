## Compiler vocabulary and modularization

**Priority:** P2
**Status:** open

### Problem

Compiler contributors need one concise architecture document that defines the
representations, the transformations between them, and the module that owns
each decision. The current compiler documentation contains substantial design
information, but parsing, desugaring, binding, graph analysis and code emission
are spread across implementation descriptions. The same words can therefore
suggest different responsibilities to different contributors.

The JS and Rust writers illustrate the boundary we need to make explicit.
Their shared-node counting has already been consolidated:
[identity-shared-walks](../edag/todo/identity-shared-walks.md) records the completed
work. Binding and block-placement decisions still live in the writers. A
common graph-to-BAST conversion should own those decisions for every target.

This issue defines the target vocabulary and module organization, followed by
incremental implementation. It spans JS syntax infrastructure, EDAG, Rust
output and compiler orchestration, so it lives in `fjs/todo/`.

### Proposal

#### Vocabulary

| Term | Meaning |
| --- | --- |
| JS tokens | Lexical tokens with the metadata needed to parse JS, including relevant line boundaries and source locations. |
| AST | The syntax representation of a supported subset of JavaScript. That subset may be larger than FunctionalScript. It does not promise support for all JavaScript. |
| BAST | Basic AST: the explicitly defined subset of AST after syntax sugar has been removed. The same representation is used before EDAG construction and after EDAG-to-BAST conversion. |
| Desugaring | AST-to-BAST rewriting that preserves the supported source semantics while expressing sugar through basic constructs. |
| EDAG | Expression DAG: operations and their references, with explicit sharing, invocation scopes and required evaluation. One shared node is different from distinct equal nodes. |
| Anchor | A required computation retained through a comma node even when the returned value does not otherwise require it. |
| Graph optimization / EDAG-eval | EDAG-to-EDAG transformation. The output remains a graph; this is distinct from runtime execution that produces a value or failure. |
| Graph-to-BAST conversion | Recovery of explicit bindings and blocks from the graph, including placement of shared computations in their correct evaluation regions. |
| Serialization | Conversion of BAST to a target language's tokens or marked text. |
| Marked text | Text accompanied by token-category marks for presentation, using the existing `fjs/text/marked` representation. It is distinct from a parser's token stream. |
| Demarking | Removing presentation marks without changing the text, using the existing `toText` operation. |

The symmetry is in the conversion boundaries:

| Layer | Parse direction | Serialize direction |
| --- | --- | --- |
| Lexical | JS text → JS tokens | Target tokens → marked text → text |
| Syntax | JS tokens → AST; AST → BAST through desugaring | BAST → JS or Rust tokens |
| Graph | BAST → EDAG | EDAG → BAST |

EDAG optimization is a separate graph-to-graph step. Parsing, desugaring,
graph construction and optimization remain explicit operations even when
neighboring operations share a module. A convenience API may compose them.

These are complementary conversions, not promises to recover original
formatting or identifier spelling. BAST-to-EDAG-to-BAST must preserve the
defined semantics, sharing and conditional evaluation. Any stronger graph
round-trip guarantee must state its supported domain and permitted
normalizations.

#### Proposed module map

| Module | Responsibility |
| --- | --- |
| `fjs/js/tokenizer` | JS text to tokens, and token rendering back to marked/plain text. Own lexical spelling, escaping and separation. Reuse the existing tokenizer. |
| `fjs/js/ast` | AST and BAST definitions, with an explicit list of basic constructs and their invariants. |
| `fjs/js/ast/sugar` | The `desugar` function: AST → BAST. |
| `fjs/js/ast/serializer` | BAST → JS tokens; marked-text output composes this with token rendering. |
| `fjs/js/ast/parser` | A stream of JS tokens → AST. |
| `fjs/edag` | EDAG definitions, operation shapes and invariants, independent of a particular producer or backend. |
| `fjs/edag/from_bast` | BAST → EDAG, preserving bindings as graph references and required evaluation as anchors. |
| `fjs/edag/optimizer` | Explicit EDAG → EDAG transformations. |
| `fjs/edag/to_bast` | EDAG → BAST; one shared implementation of binding and block placement for all backends. |
| `fjs/rust/serializer` | BAST → Rust tokens or marked text, with Rust-specific syntax and runtime operation spelling. |

The module map is a proposal, not a description of the current directories.
The initially proposed names `fjs/edag/parser` and `fjs/edag/serializer` remain
alternatives to `from_bast` and `to_bast`. Prefer the explicit names because
they identify the basic-AST boundary and avoid confusion with reading or
writing an EDAG document as data. Settle the names in the architecture
increment before moving modules.

Token rendering owns target-specific lexical rules; the BAST serializers own
syntactic structure and precedence. Marked-text representation and demarking
stay language-independent in `fjs/text/marked`. A marked-text convenience
function composes the stages rather than implementing another renderer.
Reuse the existing Rust literal and item helpers when assigning their final
owners; this proposal does not require a Rust input parser.

#### Ownership and contracts

- **JS syntax infrastructure is reusable.** Parsing a JS-subset AST does not
  establish FJS acceptance. `fjs/compiler` owns FJS admission, loading/linking
  and orchestration. Run source-level checks before desugaring erases the
  constructs those checks inspect. Document where binding resolution and
  capture discovery occur.
- **Desugaring owns syntax sugar.** Later stages receive BAST and do not
  reinterpret destructuring or defaults. Preserve one evaluation of an
  initializer, use fresh bindings, retain relevant source origins, and
  preserve scope, conditional evaluation and observable function arity.
- **Graph construction preserves source sharing.** References to one binding
  refer to one graph node. Distinct equal expressions remain distinct unless
  an explicit, permitted optimization merges them.
- **Optimization is independent of correct lowering.** Graph construction
  must produce a correct EDAG without relying on optimization. An anchor can
  be removed when the remaining computation already guarantees evaluation of
  the same node in the same invocation/evaluation region. Merely finding it
  behind a conditional or inside another function is insufficient.
- **Graph-to-BAST owns placement.** Shared computations become explicit
  bindings in the appropriate function or conditional block. Preserve
  captures and eager/lazy boundaries. Target serializers consume that
  placement; they do not each rediscover sharing or move computations.
- **Backends own target spelling and runtime mapping.** JS and Rust may need
  different syntax and runtime helpers while consuming the same placed BAST.
  Preserve the existing failure contract: successful paths and required
  failures matter; the first failing operation is not a language observation.
- **Graph identity is explicit.** Record whether an optimization changes the
  graph used for content identity and function text, or only an execution
  representation. Equivalent results alone do not settle that contract.
- **Validation respects boundaries.** Internal producers maintain their
  representation invariants. Separately supplied EDAG data is validated at
  its admission boundary, as today.

#### Examples the design must explain

Destructuring a computed initializer reads it once:

```js
const { a, b } = makeObject();
```

becomes conceptually:

```js
const temporary = makeObject();
const a = temporary.a;
const b = temporary.b;
```

For default parameters, the conditional is
`a_ === undefined ? 5 : a_`. Removing the default syntax must also preserve
function length. For `const f = (a = 5) => a`, a conceptual lowering is:

```js
const f = (...args) => {
    const a_ = args[0];
    const a = a_ === undefined ? 5 : a_;
    return a;
};
```

Generated names stand for fresh bindings. The
[default-parameter proposal](../../spec/todo/3125-default-parameters.md) owns
the feature's detailed semantics and admission; this architecture issue does
not independently enable it.

A conditional reference does not make an eager anchor redundant:

```js
const f = flag => {
    const x = null.a;
    return flag ? x : 0;
};
```

The initializer remains required when `flag` is false. Conversely, a
computation originating only inside a lazy branch must stay inside that
branch when the EDAG becomes BAST.

#### Scope and migration

The first deliverable is a short architecture document in the compiler
documentation, with the vocabulary, paired directions, module map and
contracts above. Link it from the compiler README and agent/contributor
guidance. Keep detailed operation semantics in their existing owners.

Map current modules to the proposed responsibilities before moving them:
`fjs/js/tokenizer`, the compiler's tokenizer adapter, parser/syntax tree,
`compiler/ast`, `compiler/edag`, the JS serializer, `edag/sharing`,
`edag/analysis`, `edag/rust`, `compiler/rust`, and the Rust media helpers.
Distinguish responsibilities already shared from those still to extract.

Implement small, complete changes with their consumers and documentation
updated together. Reuse existing implementations, retire replaced paths, and
reconcile overlapping TODOs rather than creating competing designs.

General constant evaluation is **outside the MVP**. Naming its EDAG optimizer
owner does not make implementing it a prerequisite for this modularization.
The architecture also adds no source-language feature by itself.

### Tasks

- [ ] Publish the compiler architecture and vocabulary, settle conversion
      names, define BAST's supported constructs and invariants, and record
      current versus proposed ownership. Link the document from contributor
      and agent entry points.
- [ ] Separate reusable JS AST parsing and desugaring from FJS admission,
      recording binding/capture and source-location responsibilities; migrate
      the relevant APIs and their consumers.
- [ ] Establish the paired lexical APIs and BAST-to-JS serialization, reusing
      existing token and marked-text machinery.
- [ ] Expose BAST-to-EDAG construction with explicit sharing, scope and
      anchoring contracts; keep graph optimization a separate operation.
- [ ] Extract EDAG-to-BAST binding and block placement once and move JS and
      Rust output onto it, reusing existing sharing analysis and target helpers.
- [ ] Prove the boundaries as their implementations move: shared versus equal
      nodes, invocation/capture scopes, eager and lazy computations, unused
      failing initializers, applicable desugaring and arity cases, and semantic
      round trips. Verify plain output equals demarked output and keep affected
      compiler demos working. Run the checks required by each implementation
      diff.
- [ ] Reconcile related TODOs and retired paths, retain the final design in
      README/JSDoc owners, and delete this issue when the modularization ships.

### Related

- [Compiler README](../compiler/README.md) and
  [parser README](../compiler/parser/README.md) — current architecture.
- [EDAG](../edag/README.md) — graph identity, scopes and operations.
- [Shared identity traversal](../edag/todo/identity-shared-walks.md) — shared
  counting already completed and remaining traversal questions.
- [Operand classification ownership](../edag/todo/operand-classification-owner.md)
  — existing eager/lazy analysis work to reconcile with common placement.
- [Marked text](../text/marked/README.md) — existing representation and demarking.
- [Failure contract](../../spec/README.md#failure-is-one-outcome) — permitted
  reordering and preservation of successful paths.
- [Group modules by concern](./group-fjs-subdirectories-by-concern.md) — related
  directory organization.
- [Design principles](../../doc/DESIGN.md) — simplicity, reuse and incremental
  design.
