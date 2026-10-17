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
common graph-to-FAST conversion should own sharing, bindings and evaluation
regions for every MVP target. The MVP prioritizes minimal implementation code
and consistent behavior across languages through one shared conversion.

The specification has the same gap from the reader's side. A page says what
a feature accepts and, for sugar, what it lowers to — a pattern "is sugar
over reads the language has", a guard "adds no node" — but not which stage
does it, so the website that will show the pages cannot say where a feature
is implemented, and a contributor cannot tell a placement that follows the
design from one that drifted. Today the parser's fold desugars while it
resolves names, and a module becomes a function in two places;
[below](#where-a-feature-is-implemented) records both.

This issue defines the target vocabulary and module organization, followed by
incremental implementation. It spans JS syntax infrastructure, EDAG, Rust
output and compiler orchestration, so it lives in `fjs/todo/`.

### Proposal

#### Vocabulary

| Term | Meaning |
| --- | --- |
| JS tokens | Lexical tokens with the metadata needed to parse JS, including relevant line boundaries and source locations. |
| AST | The syntax representation of a supported subset of JavaScript. That subset may be larger than FunctionalScript. It does not promise support for all JavaScript. |
| FAST | Foundation AST: the desugared subset of the supported JavaScript AST, with explicit bindings, blocks and core loop forms. The same representation is used before EDAG construction and after EDAG-to-FAST conversion. Representability in FAST does not by itself establish FJS acceptance. |
| Desugaring | AST-to-FAST rewriting that preserves the supported source semantics while expressing sugar through basic constructs. |
| EDAG | Expression DAG: operations and their references, with explicit sharing, invocation scopes and required evaluation. One shared node is different from distinct equal nodes. |
| Anchor | A required computation retained through a comma node even when the returned value does not otherwise require it. |
| Graph optimization / EDAG-eval | EDAG-to-EDAG transformation. The output remains a graph; this is distinct from runtime execution that produces a value or failure. |
| Graph-to-FAST conversion | Recovery of explicit bindings, blocks and eligible tail loops from the graph, including placement of shared computations in their correct evaluation regions. |
| Serialization | Conversion of FAST to a target language's tokens or marked text. |
| Marked text | Text accompanied by token-category marks for presentation, using the existing `fjs/text/marked` representation. It is distinct from a parser's token stream. |
| Demarking | Removing presentation marks without changing the text, using the existing `toText` operation. |

FAST names this foundation representation without implying FJS admission.
The older [demo document](../../todo/demo/README.md), explicitly marked stale,
uses BAST for a different concept, "Binary Abstract Syntax Tree". That
historical meaning is not renamed or adopted by this proposal.

FAST retains core `let`, `while` and assignment forms for structured loop
emission. `from_fast` lowers these forms to the existing tail-call EDAG;
`to_fast` reconstructs eligible loops. This adds no EDAG loop node or new
source-language syntax.

The symmetry is in the conversion boundaries:

| Layer | Parse direction | Serialize direction |
| --- | --- | --- |
| Lexical | JS text → JS tokens | Target tokens → marked text → text |
| Syntax | JS tokens → AST; AST → FAST through desugaring | FAST → JS or Rust tokens |
| Graph | FJS-admitted FAST → EDAG | EDAG → FAST |

EDAG optimization is a separate graph-to-graph step. Parsing, desugaring,
graph construction and optimization remain explicit operations even when
neighboring operations share a module. A convenience API may compose them.

These are complementary conversions, not promises to recover original
formatting or identifier spelling. For FJS-admitted input,
FAST-to-EDAG-to-FAST must preserve the defined semantics, sharing and
conditional evaluation. Any stronger graph
round-trip guarantee must state its supported domain and permitted
normalizations.

#### Proposed module map

| Module | Responsibility |
| --- | --- |
| `fjs/js/tokenizer` | JS text to tokens, and token rendering back to marked/plain text. Own lexical spelling, escaping and separation. Reuse the existing tokenizer. |
| `fjs/js/ast` | AST and FAST definitions, with an explicit list of basic constructs and their invariants. |
| `fjs/js/ast/sugar` | The `desugar` function: AST → FAST. |
| `fjs/js/ast/serializer` | FAST → JS tokens; marked-text output composes this with token rendering. |
| `fjs/js/ast/parser` | A stream of JS tokens → AST. |
| `fjs/edag` | EDAG definitions, operation shapes and invariants, independent of a particular producer or backend. |
| `fjs/edag/from_fast` | FJS-admitted FAST → EDAG, preserving bindings as graph references and required evaluation as anchors. |
| `fjs/edag/optimizer` | Explicit EDAG → EDAG transformations. |
| `fjs/edag/to_fast` | EDAG → FAST; one shared implementation of semantic bindings, evaluation-region placement and tail-loop lowering for all backends. |
| `fjs/rust/serializer` | FAST → Rust tokens or marked text, with Rust-specific syntax and runtime operation spelling. |

The module map is a proposal, not a description of the current directories.
The initially proposed names `fjs/edag/parser` and `fjs/edag/serializer` remain
alternatives to `from_fast` and `to_fast`. Prefer the explicit names because
they identify the Foundation AST boundary and avoid confusion with reading or
writing an EDAG document as data. Settle the names in the architecture
increment before moving modules.

Token rendering owns target-specific lexical rules; the FAST serializers own
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
- **Desugaring owns syntax sugar.** Later stages receive FAST and do not
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
- **Graph-to-FAST owns placement and binding decisions.** Shared computations
  become explicit bindings in the appropriate function or conditional block.
  Preserve captures and eager/lazy boundaries. Every MVP target consumes the
  same placed FAST. Any additional expression-to-binding normalization needed
  for emission belongs in common FAST processing used by all targets, rather
  than a separate binding policy in the Rust serializer.
- **Graph-to-FAST owns tail-loop lowering.** Reuse `edag/loop`'s `loopOf`
  and `keepsRecursion` in the common conversion. It decides whether to keep
  recursion, emit a loop within a function, or replace an eligible immediate
  call with a loop in its enclosing block. Make per-iteration bindings and
  value captures explicit in FAST before serialization; removing a call or
  function boundary must preserve its capture and evaluation semantics.
  The [tail-loop migration](../edag/todo/tail-call-loop.md#fast-migration)
  supersedes writer-specific decisions and records the closure, lazy-sharing
  and stack-safety requirements. Every target renders the same decision;
  none recognizes or lowers tail calls itself.
- **MVP backends own target spelling and runtime mapping.** Serializers render
  the bindings and computations already expressed in FAST, using the target's
  syntax and runtime operations. They do not traverse EDAG, rediscover graph
  sharing, merge distinct computations or move them across conditional or
  function boundaries. Preserve the existing failure contract: successful
  paths and required failures matter; the first failing operation is not a
  language observation.
- **Graph identity is explicit.** Record whether an optimization changes the
  graph used for content identity and function text, or only an execution
  representation. Equivalent results alone do not settle that contract.
- **Validation respects boundaries.** Internal producers maintain their
  representation invariants. Separately supplied EDAG data is validated at
  its admission boundary, as today.

#### Where a feature is implemented

Every feature the specification describes names the layer that implements
it, in the vocabulary above, beside its status line: the page the website
shows then says what a feature compiles to *and* where that is decided, and
a contributor opens the module the layer maps to. The layer is where the
feature's decision is made, not every stage it passes through — a pattern
is in the AST and gone from FAST, so it is desugaring's, and the reads it
lowers to are graph construction's as any access is. The
[specification tree](../../spec/todo/spec-tree.md) owns the page layout;
this issue owns the vocabulary the line uses and the placements below.

| Layer | Decides |
| --- | --- |
| Tokenizer | Spelling: what is a token, escapes, line boundaries. |
| Grammar | Shape: which token sequences are a module, a statement, a value. |
| Binding | Names: what a word resolves to, captures, and JavaScript's own early errors that read a word — a name bound twice, a reserved word bound — checked before desugaring erases what they inspect. |
| Desugaring | Sugar: a construct expressed through FAST's basic constructs. |
| Admission | What FunctionalScript keeps of the supported JavaScript subset, and the refusals that are its own and no early error of JavaScript's — a prototype name as a key, `o.toString`, a reserved global, a bare `__proto__` key, a prohibited member call — run before desugaring erases what they inspect; `fjs/compiler` owns it. |
| Graph construction (`from_fast`) | Sharing, scopes, anchors, and the lowering of FAST's loop forms to tail calls. |
| Graph optimization | An EDAG-to-EDAG rewrite, recorded as one. |
| Graph-to-FAST (`to_fast`) | Bindings, blocks, placement and tail loops in output. |
| Serialization | A target's spelling of FAST and of its runtime operations. |
| Evaluation | What a value converts to, what fails, what a built-in answers: the interpreter's and the VM's. |

Where a feature lives today, and where the vocabulary places it:

| Feature | Today | Layer |
| --- | --- | --- |
| Destructuring, a `const`'s or a parameter's | The fold: `planned` and `lowered`, `functionScope` for a parameter | Desugaring |
| Default parameters | The fold: `functionScope` and `lateRound`, one conditional entry reading the rest array twice | Desugaring, two fresh entries |
| Guards, `if` | The fold: `bodyRound` | Desugaring |
| The `let`/`while` loop | The fold: `loopRound`, to self recursion | FAST keeps it; `from_fast` lowers it, `to_fast` reconstructs it |
| A pattern over `Object` or `Number` | The fold: `namespaceOf` | Desugaring, over binding's static read |
| A module as a function over its imports | The fold's `AstModule`, then `unresolved` and `Unresolved` in `compiler/edag` | Desugaring, with the import metadata beside the function |
| Resolution, captures, JavaScript's early errors | The fold | Binding, before desugaring |
| FunctionalScript's own refusals: a prototype name, a reserved global, `__proto__`, a prohibited call | The fold | Admission, before desugaring |

**Destructuring is the fold's today and belongs to desugaring.** The syntax
tree, [`parser/syntax`](../compiler/parser/syntax/types.ts)'s
`BindingTarget`, is the last representation that holds a pattern: the fold
in [`parser`](../compiler/parser/module.f.mjs) writes the reads the pattern
is sugar for while it resolves names, and `AstModule` has no node for it
([spec: destructuring](../../spec/bindings/destructuring.md)). The same fold
owns every other sugar the language has, the table's rows above, so there is
no desugaring stage to point a page at: the AST of the vocabulary is that
syntax tree, and the compiler's `AstModule` is nearer FAST, its names
already indices. Under the vocabulary, binding checks the words a pattern
binds, admission its keys, and `desugar` writes the reads after both, the
[example below](#examples-the-design-must-explain); the fold keeps what
reads a word or a line.

**A default parameter is the fold's today and desugars to two entries.**
`functionScope` reads a parameter from the first default on from the rest
array, `['.', ['rest'], i]`, and the fold lands it as one entry, the
conditional `r[0] === undefined ? 5 : r[0]` with the read spelled twice,
which is the form the outputs write
([spec: parameters](../../spec/functions/parameters.md)). Desugaring writes
it as two fresh bindings of the body, the read once, the
[example below](#examples-the-design-must-explain): the initializer is
evaluated once, nothing after desugaring knows a default was written, and
the function's `length` still stops at the first default. A default inside
a pattern, `{ a = 1 }`, refused today, is the same two entries over the
pattern's read, so it lands in desugaring with the rest.

**A module becomes a function in two places and belongs to one.**
[Spec: modules](../../spec/modules/README.md#a-module-is-a-function) says a
module is one function over its imports. The fold writes it as `AstModule`,
`[imports, body]`, the body reading import `i` as `['aref', i]` with the
import list beside it; `unresolved` in
[`compiler/edag`](../compiler/edag/module.f.mjs) then spells the read as
`['.', ['.', ['args'], i], name]` and wraps the graph as `Unresolved`,
`{ imports, edag }`, the specifiers riding beside it for `resolve` to link.
Under the vocabulary, desugaring makes the module an ordinary FAST function
over its imports, with the record resolution needs beside it,
the [example below](#examples-the-design-must-explain), and nothing in
FAST is module-specific: `from_fast` compiles a function, and linking
applies it to the export objects the record names. Whether the unresolved
EDAG keeps the `['args']` root or is the function node applied at link is
settled in the architecture increment; `AstModule` and `Unresolved` are
then the two representations to retire.

#### Examples the design must explain

Three desugarings, each the program and what it becomes conceptually;
generated names stand for fresh bindings, entries of the body as a
pattern's hidden entries are. **Destructuring** of a computed initializer
reads it once:

```js
const { a, b } = makeObject();
```

becomes

```js
const c0 = makeObject();
const a = c0.a;
const b = c0.b;
```

A **default parameter** reads its argument once and tests it, and removing
the default syntax preserves the function's `length`, which stops at the
first default: `const f = (a = 5) => a` becomes

```js
const f = (...rest) => {
    const c0 = rest[0];
    const c1 = c0 === undefined ? 5 : c0;
    return c1;
};
```

The [default-parameter proposal](../../spec/todo/3125-default-parameters.md)
owns the feature's detailed semantics and admission; this architecture
issue does not independently enable it.

A **module** is a function over its imports, with the information
resolution needs to load them beside it:

```js
import a from "./a.f.js";
import { b, c } from "./b.f.js";
import d from "./d.json" with { type: "json" };
import {} from "./e.f.js";
export const e = [a, b, c, d];
export default e;
```

becomes

```js
const imports = [
    { specifier: "./a.f.js", json: false, name: "default" },
    { specifier: "./b.f.js", json: false, name: "b" },
    { specifier: "./b.f.js", json: false, name: "c" },
    { specifier: "./d.json", json: true, name: "default" },
    { specifier: "./e.f.js", json: false, name: null },
];
const module = (a, b, c, d, m4) => {
    const e = [a, b, c, d];
    return { default: e, e };
};
```

One parameter per import record, in source order: a record per binding,
and one for an import list that binds no name, `import {} from "./e.f.js"`,
its `name` `null` and its parameter the module's export object, which the
body never reads and link loads all the same, so the dependency is
evaluated and a failure in it kept, as the specification requires
([imports](../../spec/modules/imports.md)) and as `AstImport`'s own `null`
has it. Beside the function is what the function cannot say: the specifier
and the `json` attribute, which decide what is loaded, and the export
selected, which link checks against the module's exports as it does today,
refusing one the module does not have. Module identity is the host's to
establish and not desugaring's — two specifiers may resolve to one
identity, and each import carries its own attribute and selected-export
checks — so the records stay one per syntactic import, and link passes one
module's export to every parameter that selects from it, which is the
sharing the specification requires
([imports](../../spec/modules/imports.md)). This is the shape `AstImport`
already has, an `aref` being that parameter; what changes is that the
function is an ordinary one, which `from_fast` compiles as any other, and
that linking applies it to the selected exports, so the linked program has
no parameter left
([spec: a module is a function](../../spec/modules/README.md#a-module-is-a-function)).

Beyond desugaring, one rule of the graph: a conditional reference does not
make an eager anchor redundant:

```js
const f = flag => {
    const x = null.a;
    return flag ? x : 0;
};
```

The initializer remains required when `flag` is false. Conversely, a
computation originating only inside a lazy branch must stay inside that
branch when the EDAG becomes FAST.

#### Scope and migration

**The MVP output path is EDAG → FAST → target serialization for every target.**
Its goal is minimal code, one implementation of shared compiler decisions and
consistent behavior across languages. An optimized Rust or other backend may
benefit from consuming EDAG directly in the future; such a backend is outside
the MVP and is not a reason to retain parallel placement or binding algorithms
now.

This supersedes preserving the current per-writer binding policy: the Rust
writer's extra bindings for unshared operations are not an MVP compatibility
requirement. During migration, use the common FAST policy for both JS and Rust,
updating output expectations while preserving semantics. The earlier proposal
to retain target-local expression-to-binding decisions is replaced by this
shared policy.

The first deliverable is a short architecture document in the compiler
documentation, with the vocabulary, paired directions, module map and
contracts above. Link it from the compiler README and agent/contributor
guidance. Keep detailed operation semantics in their existing owners.

Map current modules to the proposed responsibilities before moving them:
`fjs/js/tokenizer`, the compiler's tokenizer adapter, parser/syntax tree,
`compiler/ast`, `compiler/edag`, the JS serializer, `edag/sharing`,
`edag/analysis`, `edag/loop`, `compiler/serializer/function_text`, `edag/rust`,
`compiler/rust`, and the Rust media helpers.
Distinguish responsibilities already shared from those still to extract.

Implement small, complete changes with their consumers and documentation
updated together. Reuse existing implementations, retire replaced paths, and
reconcile overlapping TODOs rather than creating competing designs.

General constant evaluation is **outside the MVP**. Naming its EDAG optimizer
owner does not make implementing it a prerequisite for this modularization.
The architecture also adds no source-language feature by itself.

### Tasks

- [ ] Publish the compiler architecture and vocabulary, settle conversion
      names, define FAST's supported constructs and invariants, and record
      current versus proposed ownership. Link the document from contributor
      and agent entry points.
- [ ] Name on every specification page the layer that implements its
      feature, in this vocabulary, and move the placements the table records
      — destructuring and the module function first — as their modules move,
      each page updated with the code that moves.
- [ ] Separate reusable JS AST parsing and desugaring from FJS admission,
      recording binding/capture and source-location responsibilities; migrate
      the relevant APIs and their consumers.
- [ ] Establish the paired lexical APIs and FAST-to-JS serialization, reusing
      existing token and marked-text machinery.
- [ ] Expose FAST-to-EDAG construction with explicit sharing, scope and
      anchoring contracts; keep graph optimization a separate operation.
- [ ] Extract EDAG-to-FAST binding and block placement once and move every MVP
      target, including JS and Rust, onto it. Reuse existing sharing analysis
      and target helpers, move any necessary binding normalization into common
      FAST processing, and retire parallel backend placement/binding policies.
- [ ] Move tail-loop recognition, recursion decisions and eligible call
      elimination into `to_fast`, representing per-iteration scope and value
      captures in FAST. Migrate source, Rust and function-text consumers with
      the [tail-loop requirements](../edag/todo/tail-call-loop.md#fast-migration),
      preserving existing stack-safe cases and the function-text contract.
- [ ] Prove the boundaries as their implementations move: shared versus equal
      nodes, invocation/capture scopes, eager and lazy computations, unused
      failing initializers, applicable desugaring and arity cases, common
      binding decisions across targets, and semantic round trips for
      FJS-admitted input. Verify plain output equals demarked output and keep affected
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
- [Rust binding emission](../edag/rust/todo/let-bindings-owner.md) — compiler
  and corpus bindings migrate to the common FAST path; supersedes the earlier
  separate EDAG-aware emission proposal.
- [Tail-call loops](../edag/todo/tail-call-loop.md#fast-migration) — existing
  loop emission and its migration from writers into common FAST conversion.
- [Operand classification ownership](../edag/todo/operand-classification-owner.md)
  — existing eager/lazy analysis work to reconcile with common placement.
- [Marked text](../text/marked/README.md) — existing representation and demarking.
- [Failure contract](../../spec/principles/README.md#failure-is-one-outcome) — permitted
  reordering and preservation of successful paths.
- [Group modules by concern](./group-fjs-subdirectories-by-concern.md) — related
  directory organization.
- [Specification tree](../../spec/todo/spec-tree.md) — the page layout the
  layer line joins.
- [A module is a function](../../spec/modules/README.md#a-module-is-a-function)
  and [destructuring](../../spec/bindings/destructuring.md) — the two
  features placed above.
- [Design principles](../../doc/DESIGN.md) — simplicity, reuse and incremental
  design.
