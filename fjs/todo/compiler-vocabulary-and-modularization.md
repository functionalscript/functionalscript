## Compiler vocabulary and modularization

**Priority:** P2
**Status:** wip — normalized FAST, source binding identities and complete write/
capture facts are implemented; structured source normalization and shared output
migration are in progress

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

**FAST describes the steps of computation; EDAG describes its goal and value
dependencies.** FAST makes bindings, evaluation regions and control flow
explicit. An EDAG is rooted in the requested result and records the values
needed to compute it. Sharing, required evaluation and conditional evaluation
remain part of the graph's semantics; graph-to-FAST conversion turns those
constraints into an execution plan.

| Term | Meaning |
| --- | --- |
| JS tokens | Lexical tokens with the metadata needed to parse JS, including relevant line boundaries and source locations. |
| AST | The syntax representation of a supported subset of JavaScript. That subset may be larger than FunctionalScript. It does not promise support for all JavaScript. |
| FAST | Foundation AST: a foundation IR with explicit bindings, evaluation regions and structured control flow. Binding analysis classifies reassignment; normalization produces immutable values and explicit branch/loop state; preparation produces target-ready slots and transfers. Its shape and primitives need not be a subset of JavaScript AST; core `loop` replaces source `while` syntax. These are stages of one vocabulary, used before EDAG construction and after EDAG-to-FAST conversion. Representability in FAST does not by itself establish FJS acceptance. |
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

The [FAST contract](#fast-contract) below defines the common representation.
The [epic](./general-loops-and-tail-calls.md#implementation-order) requires its
implementation and migration of the existing language before new features.
Language admission and detailed conversion algorithms stay with their owners.

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
| `fjs/js/ast` | AST and shared FAST definitions, binding/target identities, shared write/capture analysis, and binding/normalized/prepared stage contracts. |
| `fjs/js/ast/sugar` | AST → FAST sugar expansion, followed by normalization after binding analysis and source admission; owns source sugar and explicit source branch/loop signatures. |
| `fjs/js/ast/prepare` | Normalized → prepared FAST: shared slot/temporary lowering, invocation lifetimes and value captures for all serializers. |
| `fjs/js/ast/serializer` | Prepared FAST → JS tokens; marked-text output composes this with token rendering. |
| `fjs/js/ast/parser` | A stream of JS tokens → AST. |
| `fjs/edag` | EDAG definitions, operation shapes and invariants, independent of a particular producer or backend. |
| `fjs/edag/from_fast` | Normalized FAST → EDAG; consumes explicit bindings and loop signatures, preserving references/anchors and constructing recursion. |
| `fjs/edag/optimizer` | Explicit EDAG → EDAG transformations. |
| `fjs/edag/to_fast` | EDAG → FAST; one shared implementation of semantic bindings, evaluation-region placement and tail-loop lowering for all backends. |
| `fjs/rust/serializer` | Prepared FAST → Rust tokens or marked text, with Rust-specific syntax and runtime operation spelling. |

The module map is the target organization, not the current directories.
Use `from_fast` and `to_fast` for the graph boundaries; this distinguishes
them from reading/writing an EDAG document as data.

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
  constructs those checks inspect. Resolve names and reject illegal `const`
  writes while source declaration kinds are available. Shared FAST analysis
  discovers writes/captures after pattern expansion preserves their identities;
  FJS admission applies the source capture policy to those facts.
- **Desugaring owns syntax sugar.** Later stages receive FAST and do not
  reinterpret destructuring or defaults. Preserve one evaluation of an
  initializer, use fresh bindings, retain relevant source origins, and
  preserve scope, conditional evaluation and observable function arity.
  The [short-circuit owner](../edag/todo/short-circuit-conditionals.md) specifies
  conditional lowering and schema migration after the FAST foundation gate.
- **Graph construction preserves source sharing.** References to one binding
  refer to one graph node. Distinct equal expressions remain distinct unless
  an explicit, permitted optimization merges them.
- **Graph construction consumes explicit control flow.** State/result selection
  belongs to AST-to-FAST. The [loop-construction owner](../edag/todo/fast-loop-construction.md)
  specifies helper encoding, completion propagation and root-loop reuse.
  `from_fast` has no source-mutability or liveness analysis.
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
- **Graph-to-FAST owns tail-loop lowering.** The
  [tail-call owner](../edag/todo/tail-call-loop.md) defines existing-case migration,
  evaluation-aware eligibility and invocation requirements. It uses the common
  placement analysis; every serializer renders the same decisions.
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
  The same rule applies to schema changes such as removal of short-circuit
  tags. State the old-graph admission policy and permitted round-trip changes;
  do not silently rewrite a graph under its old identity.
- **Validation respects boundaries.** Internal producers maintain their
  representation invariants. Separately supplied EDAG data is validated at
  its admission boundary, as today.

#### FAST contract

Milestone A implements this contract with shared types and its first consumer.
The notation below describes semantics; constructor/type spelling is settled
in that implementation and documented with the exported API.

Use stable identities for bindings/values, functions and loop targets.
Identifiers printed by a serializer are presentation. Source bindings may
map to successive immutable values; that source mapping is not part of
`from_fast`'s input.

**Binding stage.** Variables and parameters use one binding record,
conceptually `Binding { id, isMutable }`; FAST has no separate `let` and
`const` declaration forms. Here `isMutable` means reassigned after
initialization, not permission to assign or mutable object contents. Source
declaration kinds remain available for source legality/diagnostics until those
checks finish; an illegal `const` assignment never becomes a mutable FAST
binding. Initialization and subsequent assignment are distinct operations.

After desugaring supported patterns/defaults into explicit bindings, run one
write/capture analysis for both locals and parameters:

1. Use the resolved binding identity of each reference and assignment. Preserve
   source scopes, binding origins and nested source function boundaries.
2. Scan the complete binding scope, including nested functions, before
   optimization. Any reassignment sets `isMutable`; declaration, parameter,
   default and destructuring initialization do not. A source reassignment
   within an initializer still counts for the binding it targets. Count writes
   even in syntactically unreachable branches; no flow/liveness proof is needed.
3. Record references from nested source functions as captures, including write
   targets. These are analysis facts; admission owns which combinations the
   current source language allows. G's proposed policy rejects
   `isMutable && captured`, including a capture before a later write.

The flag is consumed only after this analysis completes. Pattern expansion
must preserve original binding identities: reassigning a destructured parameter
is a write to its local binding, not to the fresh argument temporary. For
example, `const f = ([a]) => a * a` becomes conceptually:

```text
f = function(a0) {
    initialize a1 = a0[0]
    return a1 * a1
}
```

`f`, `a0` and `a1` all have `isMutable: false`. There is no special mutability
algorithm for destructured parameters. A notation such as `(const a) => a`
can illustrate that flag, but introduces no JavaScript syntax.

**Normalized stage.** After source capture admission, normalization replaces
reassignments with fresh immutable values and explicit branch/loop state.
All value bindings are immutable here; `from_fast` neither infers nor consumes
source mutability. Generated loop helpers are introduced only afterward.

| Normalized construct | Contract |
| --- | --- |
| Value and reference | Literals, operations and functions retain existing EDAG semantics; a reference uses an established identity rather than copying its initializer. |
| Required binding/evaluation | Establish an initializer at its position, even if its result is unused. Preserve eager anchors. |
| Shared lazy definition | Where existing EDAG sharing requires it, establish a value on its first reached use and reuse it within the owning invocation/iteration. Reuse current sharing/memo semantics; do not make it eager. |
| Result block and `yield(values)` | A value-producing block with local bindings, without a function/invocation boundary. Normal completion supplies its declared result list; an abrupt exit supplies no normal results. |
| `if(condition, then, else)` | Evaluate the condition once and only the selected arm. Normally completing arms agree on the result signature. |
| `loop L(parameters = initialValues) -> results` | Evaluate initial values once at entry. Parameters denote immutable values for one iteration; inputs and results have separate ordered signatures. |
| `continue L(values)` | Evaluate every next value under the current iteration before transferring them simultaneously to L's parameters. |
| `break L(values)` | Supply L's result signature and resume after L. |
| `return F(value)` | Exit the identified enclosing function, through structured loops. It cannot target a different ordinary function's scope. |
| `throw value` | Use the existing failure channel. |

Loop bodies have explicit next-iteration or exit transfers; no implicit
fallthrough remains. Break/continue targets are lexically enclosing loops in
the same function. References remain within their value/capture scopes.
Source labels and new EDAG operations are not implied by these internal
identities.

For example, a value-producing block can express these steps directly:

```text
result = block {
    b = a + 1
    yield(b * 2)
}
```

JavaScript can express this example as
`(() => { const b = a + 1; return b * 2; })()`. FAST represents the block
directly, without introducing a function, invocation or capture boundary.
`yield` supplies the block's results; `return F(value)` still exits the owning
function. Any elimination of a source IIFE must preserve invocation semantics
and follow source capture admission. This JavaScript spelling does not require
serializers to emit an IIFE: common preparation determines the statements and
temporaries needed by the target. In EDAG, this example's root is multiplication
whose input depends on addition; no procedural block is needed.

For example, a loop with two parameters and one result is:

```text
answer = loop L(a = initialA, b = initialB) -> (result) {
    if (done(a, b)) { break L(a) }
    continue L(b, a + b)
}
return F(answer)
```

The normalized representation has immutable values and semantic transfers.
The prepared stage uses the same shared vocabulary plus explicit local slot
declarations, reads and writes needed for target statements. Common `prepare`
retains expression-valued conditionals where they suffice, and lowers transfers
that need stateful statements to slots. Ordinary conditionals must not acquire
a dependency on the later standalone-`let` grammar. Its slot lowering must:

- Establish all next-state temporaries before writing any state slot.
- Bind fresh immutable iteration values/snapshots before creating captures;
  generated closures never capture mutable implementation slots.
- Establish result slots on every normal exit before following code reads them.
- Reset invocation-local shared values and memo storage on each new invocation
  represented by an iteration; preserve conditional evaluation.
- Keep slots private to their owning function/region and preserve lexical
  transfer targets. Serializers map the resulting instructions to syntax.

Binding, normalization and preparation are stages of one compiler IR.
`from_fast` consumes normalized FAST only; serializers consume prepared FAST.
Graph round-trip claims apply before physical preparation. No serializer
repeats state selection, placement or parallel-update analysis.

The fixed input order is source resolution and syntax/declaration checks,
pattern/sugar expansion with source evidence retained, shared write/capture
analysis, source capture admission, assignment/control-flow normalization,
then `from_fast`. Output is `to_fast`, then `prepare`, then serialization.
Small common passes state their input/output invariants and run in a fixed
order; no unbounded rewrite-until-stable driver or general optimizer is required.
Source checks always finish before a pass erases the evidence they inspect.
Source capture checks precede generated functions, and only graph construction
introduces recursive helpers.

A/B establish the binding representation and shared analysis while preserving
current source acceptance, including its existing loop capture exceptions.
Retain source-origin metadata needed by that admission policy until G replaces
it with the [proposed uniform rule](../../spec/todo/3220-let.md#general-bindings).
G enables the new policy and general rebinding in these same passes; it does
not introduce a second analysis or require retrofitting FAST.

A's examples/proofs cover written/unwritten locals and parameters, destructured
initialization, source `const` errors, a value-producing block without a function
boundary, a branch with results, a swapped-parameter loop, normal versus
function exit, an overwritten required initializer, lazy shared evaluation and
a captured iteration value. The API must express these before downstream work
depends on it.

A also records the supported exact-graph domains and any intentional
normalization needed by the baseline scalar root-loop round trip. B implements
that input capability before C migrates existing output. General signatures
follow in E; a foundational round-trip dependency does not wait for them.

#### Where a feature is implemented

Every feature the specification describes names the layer that implements
it, in the vocabulary above, beside its status line: the page the website
shows then says what a feature compiles to *and* where that is decided, and
a contributor opens the module the layer maps to. The layer is where the
feature's decision is made, not every stage it passes through — a pattern
is in the AST and gone from FAST, so it is desugaring's, the reads it
lowers to are graph construction's as any access is, and the serialize
direction's reverse of a decision, `to_fast` rebuilding a loop from a
tail call, is the output's and no second owner. The
[specification tree](../../spec/todo/spec-tree.md) owns the page layout;
this issue owns the vocabulary the line uses and the placements below.

| Layer | Decides |
| --- | --- |
| Tokenizer | Spelling: what is a token, escapes, line boundaries. |
| Grammar | Shape: which token sequences are a module, a statement, a value. |
| Binding | Names and facts: resolve identities and declaration legality before source evidence is erased; after pattern expansion, shared FAST analysis discovers writes and captures. Admission uses these facts without repeating the analysis. |
| Desugaring | Sugar: a construct expressed through FAST's basic constructs, including short-circuit operators as single-evaluation conditionals. |
| Admission | What FunctionalScript keeps of the supported JavaScript subset, including its capture policy and refusals such as a prototype key, `o.toString`, a reserved global, a bare `__proto__` key or a prohibited member call. Source-shape checks precede expansion that erases their evidence; capture checks follow shared analysis and precede assignment normalization/helper generation. `fjs/compiler` owns it. |
| Graph construction (`from_fast`) | Sharing, scopes, anchors, and recursive loop helpers with state results and enclosing-function completion handling. |
| Linking | Loading and linking, what the records beside a module function ask of the host and of the modules loaded: a specifier resolved to a module identity, one load and one evaluation per identity, a cycle refused, the attribute's agreement with the file, the selected export's existence; and the module function applied to what was loaded. `fjs/compiler` owns it, `_walk` in `source` and `resolve` in `edag` today. |
| Orchestration | Which steps run for an input and an output name: `fjs compile`'s dispatch by file type, a `.json` document against a module, which output evaluates and which writes a graph, the diagnostics' paths — the command-line pages' layer. `fjs/compiler`'s `module.f.mjs` and `fjs/cli` own it. |
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
| The `let`/`while` loop | The fold: `loopRound`, to self recursion | Graph construction: FAST keeps the loop and `from_fast` lowers it to a tail call; `to_fast` rebuilding one for output is no second owner |
| A pattern over `Object` or `Number` | The fold: `namespaceOf` | Desugaring, over binding's static read |
| A module as a function over its imports | The fold's `AstModule`, then `unresolved` and `Unresolved` in `compiler/edag` | Desugaring, with the import metadata beside the function |
| Module resolution, identity, cycles, the attribute's and the selected export's checks | `_walk` in `compiler/source`, `resolve` in `compiler/edag` | Linking |
| Dispatch by file type and output name, the authored `.f.js` check | `fjs/compiler/module.f.mjs`, `fjs/cli` | Orchestration |
| Resolution and JavaScript's early errors | The fold | Binding, before desugaring erases the relevant source evidence |
| Writes and captures | The fold | Shared binding analysis after pattern expansion; admission applies the source policy before normalization |
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
applies it to the export objects of the modules the records name, the
same object for two records of one module, the body selecting each
binding's export from its slot. The imports are that function's
rest array in FAST; in the EDAG they stay the module scope's own
`['args']`, which `from_fast` writes for the module function's array
where it writes `['rest']` for an invocation's, since a module is applied
by link and never called: the
[parameter plan](../../spec/todo/3120-parameters.md#module-import-bindings-are-unchanged)
keeps `['args']` the import binding, valid in an unresolved module's scope
alone, and `['rest']` invalid there, and this proposal keeps that
contract. `AstModule` and its `aref` are then the representation to
retire; `Unresolved`, the graph with its records beside it, is the same
pair at the EDAG stage.

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
const module = (...args) => {
    const a = args[0].default;
    const b = args[1].b;
    const c = args[2].c;
    const d = args[3].default;
    const e = [a, b, c, d];
    return { default: e, e };
};
```

The imports are the function's rest array, one slot per import record in
source order, each slot the export object of the module its record names:
a record per binding, whose export the body selects from the slot,
`args[1].b`, and one for an import list that binds no name,
`import {} from "./e.f.js"`, its `name` `null` and its slot unread, which
link loads all the same, so the dependency is evaluated and a failure in
it kept, as the specification requires
([imports](../../spec/modules/imports.md)) and as `AstImport`'s own `null`
has it. The body reads slot `i` as a late parameter reads `rest[i]`, so
the function's `length` is `0` and the limit of 16 fixed parameters, a
rule on the parameters a source function writes, never reaches a module's
imports ([parameters](../../spec/functions/parameters.md),
[module import bindings](../../spec/todo/3120-parameters.md#module-import-bindings-are-unchanged)).
Beside the function is what the function cannot say: the specifier and
the `json` attribute, which decide what is loaded, and the export
selected, which link checks against the module's exports as it does today,
refusing one the module does not have. Module identity is the host's to
establish and not desugaring's — two specifiers may resolve to one
identity, and each import carries its own attribute and selected-export
checks — so the records stay one per syntactic import, and link passes one
module's export object to every slot whose record names it, which is the
sharing the specification requires. This is the shape `AstImport` and the
EDAG's `['args']` already have, the slot its module's export object and
the binding's read `['.', ['.', ['args'], i], name]`, as the parameter
plan keeps them; what changes is that the function is an ordinary FAST
function, which `from_fast` compiles as it compiles any body, spelling its
import array as the module scope's `['args']` rather than an invocation's
`['rest']`, and that linking applies it to the export objects of the
modules loaded, so the linked program has no parameter left
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

Implement the epic's A-C in order: FAST model, existing input, existing output.
Use small complete increments, reusing current implementations in their final
owners and retiring each replaced path with its consumer. The foundation gate
closes when all required existing consumers use the shared pipeline with their
contracts preserved. New source features, broader tail-call handling and
short-circuit tag removal follow that gate; none is first implemented in the
old fold or a writer for later migration.

The [let proposal](../../spec/todo/3220-let.md#later),
[loop construction](../edag/todo/fast-loop-construction.md),
[tail-call analysis](../edag/todo/tail-call-loop.md#general-tail-calls) and
[short-circuit removal](../edag/todo/short-circuit-conditionals.md) own those
extensions. This architecture issue owns the shared foundation.
Unrelated tokenizer moves and general directory reorganization do not block it.

General constant evaluation is **outside the MVP**. Naming its EDAG optimizer
owner does not make implementing it a prerequisite for this modularization.
The architecture also adds no source-language feature by itself.

### Tasks

The A-C labels refer to the epic's ordered foundation milestones. Update
documentation and run the affected checks with each implementation increment.

- [ ] **A:** Implement the FAST contract with shared types, stage APIs and
      common normalization/preparation facilities, starting with a real existing
      consumer. Include one binding representation and write/capture analysis
      for locals and parameters. Publish its vocabulary, ownership map and
      invariants.
- [ ] **B:** Separate reusable JS AST parsing/desugaring from FJS admission.
      Move existing source input through normalized FAST and `from_fast`,
      preserving resolution, captures, source locations and graph contracts.
      Expand patterns before shared analysis; preserve source legality and
      current admission, leaving the new capture policy to G.
- [ ] **B:** Preserve references, scopes and required-evaluation anchors in graph
      construction. Keep existing loops structured until that boundary; the
      loop-construction owner extends its capability later.
- [ ] **C:** Extract EDAG-to-FAST placement once, using existing sharing analysis.
      Move current tail-loop decisions and immediate-call elimination there
      under the [migration contract](../edag/todo/tail-call-loop.md#fast-migration).
- [ ] **C:** Complete common preparation and migrate source JS, runtime/function
      text and Rust consumers. Reuse token/marked-text and target helpers;
      retire each replaced graph-aware writer path with its consumer.
- [ ] **C:** Prove existing shared-versus-equal nodes, invocation/capture scopes,
      eager/lazy evaluation, unused failing initializers, arity, stack safety
      and supported graph round trips. Verify plain output equals demarked output
      and keep affected demos working.
- [ ] Close the foundation gate before feature owners extend source sugar,
      loop semantics or the EDAG operation set.

The remaining architecture alignment accompanies relevant moves; unrelated
parts do not delay the epic's foundation gate:

- [ ] Establish the paired reusable lexical APIs using existing token machinery.
- [ ] Name each specification feature's implementing layer. Update affected
      pages with their code moves, then finish the remaining vocabulary alignment.
- [ ] Reconcile related TODOs and retired paths, retain final contracts in
      README/JSDoc owners, and delete this issue when its modularization ships.

### Related

- [General loops and tail calls](./general-loops-and-tail-calls.md) — dependency
  epic for the FAST prerequisites, general rebinding, loop normalization and
  broader tail-call analysis; its feature milestones follow this foundation.
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
- [Short-circuit conditionals](../edag/todo/short-circuit-conditionals.md)
  — later source sugar and canonical EDAG schema change.
- [FAST loop construction](../edag/todo/fast-loop-construction.md)
  — later explicit-loop helper construction and graph round-trip rules.
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
