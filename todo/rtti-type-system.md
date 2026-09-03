## RTTI as the type system

**Priority:** P3
**Status:** open

This is an **epic**: it states the destination and the order, and it owns no
code of its own. Each numbered stage below is, or becomes, an issue in its own
file; this one is where they are read together.

### Problem

A type in this repository is written more than once. The same shape is a
declaration in a sibling `types.ts` (or `private.ts`), the JSDoc annotations
that name it, and — where a value has to be checked at run time — an
[RTTI](../fjs/rtti/README.md) schema. Nothing keeps them in agreement: `tsc`
checks the declaration against the code and the schema against nothing, so a
schema and its declared type drift silently, and the drift shows up as a value
that type-checks and fails validation, or the reverse.

The bridge that exists runs the wrong way. `Ts<T>`
([`fjs/rtti/ts/README.md`](../fjs/rtti/ts/README.md)) maps a schema
to its TypeScript type, which makes a schema usable *from* TypeScript, and it
pays for it: `TS2589` on recursive schemas, a `WithOut` phantom annotation to
escape the walk, and three classes of `as any` cast that the README documents as
unremovable without language features TypeScript does not have. The type system
is TypeScript's, and RTTI is a guest in it.

For FunctionalScript that is backwards. FunctionalScript is not TypeScript and
will not be compiled by `tsc`; a `.f.mjs` module type-checked only by a
TypeScript toolchain has no checker at all once the FunctionalScript compiler is
the thing that reads it.

### Proposal

**This type system is a layer on top of FunctionalScript, not part of the
FunctionalScript specification.** FunctionalScript remains type-agnostic:
`//:` and `/*: */` are ordinary comments to the language; the RTTI layer gives
them meaning using the comment/token stream exposed by the toolchain.

**RTTI is the single source of truth for both compile-time and run-time type
verification of FunctionalScript.** One schema, written once, is what the
compiler checks against, what `validate`/`parse` check against at run time, and
what a published `.d.ts` is generated from.

Five commitments make that concrete.

#### 1. Types are values, written in the RTTI eDSL

There is **no type language to invent**. A type is an ordinary expression —
written in the language, in a `const`, never in a comment — built from
[`fjs/rtti/module.f.mjs`](../fjs/rtti/module.f.mjs) —
`boolean`, `number`, `string`, `bigint`, `unknown`, `array`, `record`, `or`,
`option`, `never`, `rest`, `open`, plus `Const` (a primitive, tuple, or struct
used directly as its own schema, closed). It is a value: it can be named, imported,
exported, passed to a function, and returned from one.

Being a value is not automatically free at run time, and an earlier draft of
this paragraph said it was. A schema used *only* in annotations is droppable
when it is a **local** initializer built from the RTTI constructors, because
droppability there is a property of the node. When the annotation names a
schema **imported** from another module, the import is not dropped: stage 12
anchors that module root so the program still compiles, and an anchored root is
retained and evaluated — that is what anchoring is for. So an annotation-only
import from a module with expensive or throwing top-level work is still shipped
and still runs. See
[What a compile-time-only type costs](#what-a-compile-time-only-type-costs) for
both halves, and stage 12 for what would be needed to make the imported half
free.

Anything the eDSL cannot yet say is a gap in the eDSL, to be closed there —
not a reason to grow a second notation beside it. This is the rule that keeps
the whole direction from collapsing back into "a superset of JavaScript with a
type grammar", which is the thing this project exists to avoid
([types-for-fs.md](./types-for-fs.md)).

**The eDSL is expected to grow, and growing it is library work.** Today it says
primitives, `array`, `record`, `or`, `option`, `never`, `rest`, `open`, and
consts. It
does not yet say functions
([668](../fjs/rtti/todo/668-rtti-function-types.md)) or brands
([134](./134-nominal-types-proposal.md)), and it will need to say more than
that. Because a type is a *value*, each of those is a new exported function in
a module — not a keyword, not a grammar production, not a tokenizer change, and
not an edit to the annotation form, which stays `//: name` forever.

Generics are the example worth stating, because they are usually the point at
which a type language becomes a second language. **A generic type is a function
from schemas to schemas** — and the eDSL ships two already, `array` and
`record`, which are exactly that shape. A third is a `const`:

```js
const pair = t => [t, t]          // a generic type, in the language, today

const pairOfKeys = pair(key)      // an instantiation is a `const`, like any other
//: pairOfKeys
export const kk = ['a', 1]
```

Nothing in the annotation form has to change, and no variance annotations,
inference rules, or checker support for a generic type grammar have to be
invented — roughly the entire cost TypeScript pays for the same feature. To
*write and use* a generic type, the value layer needs nothing.

**Emitting a declaration for one is a different matter, and does need something
new.** The printer takes a concrete `Type` and walks a finite schema graph;
`pair` is an opaque function whose relationship between argument and result is
nowhere represented as data, and no number of concrete instantiations
reconstructs `<T>(t: Type<T>) => Type<readonly [T, T]>`. So stage 8 is not
only rendering: it needs that relationship reified — a type-variable schema the
constructor can be applied to symbolically, or some equivalent — before a
parameterised alias can be emitted, and until then stage 11 cannot retire the
authored TypeScript declaration of an exported generic schema. Symbolic
application in turn needs the constructor to be **parametric**: one that
inspects its argument (`t => t === number ? … : …`) takes the wrong branch on a
synthetic variable. Stage 8 records the choice that follows.

#### 2. Types are applied with a comment naming one

```js
//: myType
/*: myType */
```

Annotations are **secondary to inference**: they may guide or constrain the
checker, but they are not the source of truth and cannot make an unproven type
claim true.

The body is a **name** — a single identifier, bound in the module by a `const`
or an `import`, whose value is an RTTI schema. Nothing else is accepted: no
call, no member access, no operator, no literal. The two forms hold the same
thing and differ only in placement: the line form annotates what follows it,
the block form annotates inside an expression.

Anything more than a name is written as an ordinary `const` first, in the
language, where it already belongs:

```js
import { array, number, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'

const key = or(number, string)
const keys = array(key)
const maybeKey = or(option, key)

//: key
export const a = 'hello'

export const first = (xs /*: keys */) /*: maybeKey */ => xs[0]
```

**A name, not an expression, is the whole point.** Handing the comment body to
the expression parser would still be a sub-language living in comments — with
its own scoping, its own evaluation order, its own error messages, and its own
pressure to grow, which is how every type grammar starts. A bare identifier has
none of that. It also makes recognition a single token rather than a parse, and
compile-time evaluation memoizable by binding rather than by expression
([open question 4](#open-questions)).

The restriction costs nothing, because naming a type is something you want
anyway. A named schema is exportable, reusable, printable in a diagnostic, and
emitted to `.d.ts` under that name; an inline `array(key)` is anonymous at every
one of those points.

Recognizing an annotation is then nearly free. The tokenizer keeps a comment's
body verbatim, so the forms are separated by the body's first character — `:`
is an annotation, `*` is JSDoc, anything else is a comment — and what follows
is one identifier to resolve against the module's bindings. No block grammar,
no type grammar, no second parser, and no expression parser either.

**Why a new sigil instead of `/** @type {…} */`.** Because there are two
checkers, and they must not collide. `@type` is TypeScript's tag, with
TypeScript's type language inside it; putting an RTTI name there would make one
comment the input to two tools that disagree about what its body means, and
every diagnostic would have two possible owners. A distinct sigil makes the two
sets **disjoint by construction**: `tsc` sees `/*: keys */` as an ordinary
comment and ignores it, the RTTI checker sees `/** @type {…} */` as JSDoc and
ignores it, and the body's first character is what separates them — which is
why that cheap tokenizer distinction is the mechanism here and not just an
optimization.

What disjointness buys is the whole migration. Both checkers run over the same
`.f.mjs` file at the same time, so:

- adding an RTTI annotation can never break `tsc`, which is the checker
  meanwhile (see [Non-goals](#non-goals));
- stage 11 is per-annotation, not per-module and certainly not a flag day: a
  declaration can carry both forms, one form, or neither, and the file stays
  valid input to both tools throughout;
- the step is reversible, because removing an annotation of either kind leaves
  the other untouched.

**Both on one declaration is allowed — during the transition above, mainly, but
it is a supported state rather than a tolerated one:**

```js
/** @type {readonly (number | string)[]} */
//: keys
export const ks = ['a', 1]
```

It earns its keep while the tree migrates, mainly because RTTI cannot yet say
everything — function types being the large case ([stage 7](#tasks)) — so JSDoc
covers that declaration while RTTI covers the rest of the module, in the same
file, with no either/or and no waiting for the eDSL to catch up. The end state
for a `.f.mjs` module is still the RTTI annotation alone.

**What carrying both does not do is detect drift.** Both checkers run against
the *initializer*, so they disagree only when some actual value witnesses the
disagreement — and usually none does:

```js
/** @type {number | string} */
//: string          // narrower than the JSDoc type, and nothing here says so
export const x = 'x'
```

`'x'` satisfies both, so both pass, while the two declarations plainly disagree.
Detecting *that* means comparing the declarations to each other rather than each
to a value, which is a separate, cheap, compile-time check — and one this
repository already has the pieces for, since `Ts<T>` renders a schema as a
TypeScript type and `Assert`/`Equal` pin type-level facts
([`fjs/asserts/types.ts`](../fjs/asserts/types.ts),
[`fjs/types/ts/types.ts`](../fjs/types/ts/types.ts)), exactly as
`rtti/types.ts` uses them today:

```ts
type _ = Assert<Equal<Ts<typeof declaredSchema>, DeclaredJsDocType>>
```

That is what a conversion should lean on — a claim about the two declarations —
not on both checkers happening to accept the value in front of them. Stage 11
carries it.

[type-annotations](../spec/todo/3360-type-annotations.md) is the design note for
this annotation convention despite living under `spec/todo`; it does not add
type semantics to FunctionalScript. It states the body as an expression; **this
epic narrows it to a name**, and stage 2 is where that narrowing lands.

#### 3. Every RTTI type is immutable, and that is what makes it sound

RTTI cannot describe a mutable value, and this is a feature rather than a
missing one. FunctionalScript values are immutable, and the eDSL has no way to
spell a writable member: `Ts<T>` renders every struct member, array, record,
and tuple as `readonly`
([`ts/types.ts`](../fjs/rtti/ts/types.ts)), because there is no other
thing for it to render.

That is the difference between this checker and TypeScript's, and it is not a
detail. [types-for-fs.md](./types-for-fs.md) states the flaw in one example:

```ts
type A = { p: number }
const f = (a: A) => { a.p = 42 }

const a: { p: 5 } = { p: 5 }
f(a) // accepted, and now `a.p === 42`
```

`{ p: 5 }` is assignable to `{ p: number }` and yet is not safely usable as one,
because a writer on the other side can invalidate the narrower type. Every
mutable type system then has to buy the difference back — variance rules,
`readonly` as a separate modifier to track, aliasing analysis, narrowings that
a later write silently invalidates — and TypeScript declines to, which is why
the program above compiles.

**None of that arises here.** A schema denotes a *set of immutable values*;
`subset` is inclusion between two such sets, approximated soundly on the canonical
[`data`](../fjs/rtti/data/module.f.mjs) form, with no writer anywhere to
make the answer go stale. Three concrete consequences — the first two holding
**within FunctionalScript**, for the reason the next paragraph is careful
about:

- **A check stays true.** `validate` returns the value it was handed —
  `Object.is(result, input)` — and in a language with no mutation nothing can
  change it afterwards, so verify-then-mutate, the standard hole in run-time
  validation over mutable data, has no analogue.
- **Compile time and run time agree by construction.** The same schema decides
  both, and there is no mutation in between to make the compile-time answer
  wrong at run time. That agreement is the epic's whole claim, and it is
  immutability that supports it.
- **`subset` is data, not language semantics.** Inclusion is a pure function of
  two canonical values, which is why it could ship long before the checker that
  will use it. This one holds unconditionally: it is a fact about two `Data`
  values and involves no runtime value at all. It is a *sound approximation* of
  assignability rather than assignability itself — see stage 6.

**That guarantee is the language's, not `validate`'s, and the boundary matters.**
Immutability in `fjs/` is a convention the reviewer enforces
([AGENTS.md](../AGENTS.md) §3), not something the JavaScript runtime provides —
and `validate` returns the caller's own object, unfrozen. So a caller from
ordinary JavaScript that keeps an alias can invalidate a successful result the
moment after it is returned, and today, running on Node, every caller is such a
caller. Verify-then-mutate is closed by the language, not by the reader.

`validate` should not close it by freezing or copying: returning the value it
was given *is* its contract — a content-addressed document's bytes are its
identity, so a reconstruction is a different document
([`rtti/README.md`](../fjs/rtti/README.md)) — and freezing the caller's
object would be a mutation of it. The reader for a value arriving from outside
the boundary is `parse`, which constructs a fresh value holding only what the
schema declares; the README already assigns it that role, "the reader for a
value coming *in* — from JSON, from a protocol frame".

**`parse` is the boundary only where the schema names every part.** It
constructs a fresh container, but `unknown` is `() => ok` and `ok` returns the
value it was handed
([`parse`](../fjs/rtti/parse/module.f.mjs)), so a value admitted through
an `unknown` — the whole schema, or one field of a struct — comes back as the
caller's own object, aliases intact. `parse(unknown)(obj)` *is* `obj`. So the
advice "use `parse` and hold the result" holds for a schema with no `unknown`
in it and fails quietly for one with `unknown` anywhere inside. Closing that
needs one of: restricting `unknown` in schemas used at an external boundary,
deep-copying what `unknown` admits, or saying plainly that a parsed `unknown`
is a borrowed reference.

**The general rule, of which `unknown` and a closed struct are instances:
nothing about a type establishes runtime ownership.** "Inside FunctionalScript nothing can
write" is a statement about FunctionalScript's *own* code. It says nothing
about a caller in ordinary JavaScript that passed a reference in and kept one.
An exported function that accepts and retains an array or object can have that
value mutated underneath it afterwards, and the compiler containing no writes
does not help: the write happens outside. A generated `readonly` declaration
does not close it either — `readonly` constrains what the callee may do, and
TypeScript accepts a mutable array or object where a readonly type is expected.

So the boundary rule has to apply to **every reference crossing the boundary
that both sides retain**, in either direction, not only to the schema features
TypeScript cannot express.

*Inbound* is the obvious half: each incoming reference needs `parse` against a
schema that names every part (per the paragraph above), a deep copy, a
**recursive** freeze, or an **enforceable** ownership transfer — not one the
caller is merely documented to honour, since nothing checks that and TypeScript
accepts a mutable value where a readonly input is expected. Stage 13 states what
"enforceable" would take.

**"Freeze" has to mean the whole retained graph.** `Object.freeze` is shallow:
it seals the outer container and leaves every nested reference writable, so a
caller holding `input.child` mutates it afterwards and the root being frozen
establishes nothing. Anything less than a recursive freeze over every reference
retained is not a remedy at all — and a recursive one carries costs the other
remedies do not: it **mutates the caller's own graph**, observably, which is a
side effect on data the module was only handed; it has to handle cycles; and it
cannot be applied to a graph the caller shares with something still live. Those
costs are why reconstruction — `parse`, or a deep copy — is the better default,
and freezing is listed as an option rather than the recommendation.

*Outbound is the same hole mirrored*, and it is easy to miss because the value
started inside. An exported value, or a function result, that FunctionalScript
also keeps a reference to can be mutated by the JavaScript that received it,
changing an internal value — again with no write anywhere in FunctionalScript.
**An exported schema is the sharp case**, because commitment 1 wants schemas
named, exported and shared, and a `Const` schema is an ordinary object: a
consumer that mutates the schema it was handed changes what the checker
accepts, for everyone holding it. Outbound references need the same treatment —
copy or recursive freeze on the way out, or the module relinquishes its own
alias, which
is ownership transfer in the other direction — and under the same
enforceability condition, since a note in a README binds the receiver no more
than it binds the caller.

Which remedy is a cost/ergonomics decision, and it belongs with the same person
deciding the closed-struct policy — all of it is one question asked about different
values and directions, and **[stage 13](#tasks) owns it**. Naming the question
without giving it a stage is what let it sit unowned through several revisions
of this section.

That is one more reason the regime follows what the compiler can read
(commitment 4), and a reason the guarantee in commitment 3 is worth reading as
"no FunctionalScript code writes", not "this value cannot change".

Where mutability is planned it stays outside RTTI's reach by design: local
mutable objects with ownership tracking
([mutability](../spec/todo/mutability.md)) become immutable at the point they
escape, and it is the escaped, immutable value that a schema describes.
Tracking ownership is the compiler's job; RTTI never sees a mutable value.

#### 4. Scope: FunctionalScript files only

| Source | Type system | Checked by | How long |
| --- | --- | --- | --- |
| `.f.js` | RTTI schemas + `//:` / `/*: */` | the FunctionalScript compiler | **the destination** |
| `.f.mjs` | RTTI schemas + `//:` / `/*: */`, where the compiler can read the file | the FunctionalScript compiler, once it can | en route — it may use features the parser does not support yet |
| `.mjs` | TypeScript types in JSDoc | `tsc` | indefinitely — it is ordinary JavaScript |
| `types.ts` | TypeScript | `tsc` | **for a while** — each retires with its module under stage 11 |
| `.d.ts` | TypeScript | generated, not authored | as long as TypeScript consumers exist |

Two rows are FunctionalScript, and the split between them matters. The
[extension contract](../fjs/fsc/README.md) says `.f.mjs` "may use
FunctionalScript features the current parser/compiler does not support yet",
while `.f.js` is "authored FunctionalScript that the current parser/compiler
**must** accept". So `.f.js` is where this regime is finally at home, and
`.f.mjs` is where it arrives file by file as the compiler catches up
([stage 2](../fjs/fsc/README.md#stage-2-mark-compiler-compatible-functionalscript)
is the rename).

Naming only `.f.mjs` — as an earlier draft did — got this backwards twice: it
claimed the checker for files the compiler may not be able to read, and dropped
it for the files it definitely can. **The unit is not the extension; it is
whether the compiler can read the file.** A `.f.mjs` module the parser cannot
yet accept has no RTTI checking regardless of what it is annotated with, and
stage 11 must not retire its JSDoc until it does — the rename to `.f.js` is
exactly the event that says it can.

The last column is otherwise the part that is easy to get wrong, because the two
TypeScript rows have different futures.

`.mjs` is ordinary JavaScript — mutation included, so the guarantees in
commitment 3 do not hold there — and stays in the TypeScript world
indefinitely. This is not a migration that ends with JSDoc deleted from the
tree.

**`types.ts` is different: it stays for a while, not forever.** It is a
TypeScript type-level API, and it exists because TypeScript is currently how
this repository states types. Once a `.f.mjs` module's types are RTTI schemas
and its `.d.ts` is generated from them, a `types.ts` beside it has no remaining
job — the schema *is* the type-level API, and it is a value rather than a
declaration. **Provided the compiler can read that module**: per the rule
below, a `.f.mjs` the parser does not yet accept has no RTTI checking whatever
it is annotated with, so its `types.ts` is still carrying the types and
retiring it would leave the module checked by nothing. 92 of the 94 `types.ts` files in the tree sit next to a
`module.f.mjs`, so the *file* is adjacent to a schema-bearing module in nearly
every case.

That is a fact about placement, not about contents, and the distinction
matters: a `types.ts` also holds declarations that describe no runtime value at
all — [`fjs/types/array/types.ts`](../fjs/types/array/types.ts) exports
`Index`, `Tuple`, `KeyOf`, `Includes`, conditional utilities over other types —
and no schema, printer, or reification produces those. Stage 11 states the
rule and the known exceptions.

That is not a contradiction of the stage-1 migration, which said four times
that authored `types.ts` "may remain permanently" (the surviving statement is in
[`fjs/fsc/README.md`](../fjs/fsc/README.md)) — but it is a narrower
reading of that word, and worth stating plainly. There, permanence is with
respect to *that* migration: a `types.ts` is not an implementation-migration
target and must not be forced through JSDoc translation. It says nothing about
what happens when TypeScript stops being the type system, which is what this
epic is about. Both hold: a `types.ts` survives stage 1 of that migration
untouched, and retires under stage 11 of this one.

The regimes coexist by file extension either way, which is the seam that
document already establishes, and `.f.mjs` modules keep their JSDoc and their
`types.ts` until the RTTI checker can actually replace them.

#### 5. `.d.ts` is generated, for consumers only

An npm package ships `.d.ts` so that TypeScript consumers see types; the
declarations are **generated from the schemas**, never authored.
[`fjs/rtti/ts/module.f.mjs`](../fjs/rtti/ts/module.f.mjs) is already
that printer — `thunk RTTI → toData → dataToTs`, emitting canonical aliases with
recursion handled — so this is close to plumbing plus an `fjs` command, and it
is the stage that can land earliest. Not *only* plumbing, though, and not entirely on
its own: the printer documents two places where it and `Ts<>` disagree, both of
which change what a generated declaration means, and rendering a schema is not
the same as knowing which export carries it. See stage 1. It is also what lets a
`.f.mjs` module drop its JSDoc without any consumer noticing.

### Inference, narrowing, and specialization

This system should have no unchecked equivalent of TypeScript's `as`, `as any`,
double casts, or another construct that simply tells the checker to trust a type
claim.

**Types are inferred from program behavior.** On a successful EDAG path, each
operation may refine what is known about its inputs and outputs; branches that
do not continue are excluded from that continuation. `assert` is only a
convenient ordinary operation for making such a refinement explicit, not
privileged type-system machinery. A validator's successful branch narrows by
the same rule.

Because throws are generally semantically equivalent in EDAG, refinement
normally depends on the facts established by reaching a path, not on which
throw would have happened first. Exceptional cases can be decided later without
changing this direction.

There is no unchecked escape hatch: narrowing follows from inference over
program semantics. Annotations may guide or constrain inference, but they do
not make an unproven claim true.

This does not imply permanent runtime overhead. A check used only to establish
a fact is ordinary EDAG computation. If the compiler proves that removing it
preserves semantics — for a throwing check, that includes proving it total and
always successful — it may remove the check. A conservative compiler can keep
more checks while a stronger one removes them without weakening type safety.

**The same proofs are optimization facts.** They can justify specialization
where the compiler proves the specialized operation equivalent to the original.
For example, proving a SHA-256 value and the relevant intermediate operations
fit fixed widths (or have explicit modular semantics) can replace generic
`bigint` operations with target-specific fixed-width instructions or intrinsics.

Matrices and tensors are the same pattern. Proofs may establish shape,
dimensions, element type, bounds, layout, alignment, sparsity, or device
placement. Those facts can turn generic FunctionalScript code into fixed loops,
vector operations, tiled matrix operations, fused kernels, or code targeting
CPUs, GPUs, NPUs, and other accelerators.

**Automatic differentiation is another possible transformation over the same
semantic foundation.** For an EDAG subset whose primitives have defined
derivative rules, including their behavior at nondifferentiable points,
reverse-mode differentiation can construct the backward graph used for
neural-network training; unsupported operations are outside that transform.

```text
x -> matmul -> relu -> matmul -> loss
                              |
                              v
                        differentiation
                              |
                              v
                  gradients of weights and x
```

The generated gradient graph is itself subject to the same proofs and
optimizations: known tensor shapes and element types specialize gradient
operations, dead intermediates can disappear, forward and backward operations
can be fused, and the result can be lowered to GPUs or other specialized
hardware.

The broader goal is that **domain-specific semantics live in libraries, proofs,
and program transformations rather than requiring a new language for every
domain**. FunctionalScript remains the small, type-agnostic semantic foundation;
RTTI/refinement systems, tensor libraries, automatic differentiation, and
hardware lowering live on top of it. This makes the same foundation suitable
for machine-learning programs without requiring application code to cross a
stack of specialized source languages merely to communicate facts the program
and its proofs already contain.

### What a generated `.d.ts` can and cannot promise

The epic's thesis is that one schema decides compile time and run time, so the
two agree. **For a TypeScript consumer reading a generated `.d.ts`, that
agreement is bounded by what TypeScript can express**, and in at least one case
it cannot express the schema at all.

**Three cases are known.** All are the same shape — a schema whose set
TypeScript has no way to name — and all are found in the emission path, not
invented here.

**A closed struct** is the first, and since a bare `Struct` is closed that is
every struct schema that does not say `open`. It means "these members and no
others"; TypeScript object types are structurally open, so the closed set has
no spelling, and both the printer and `Ts<>` emit the fields alone — the
closest expressible *supertype*. A consumer can hold `{ a: 1, b: 2 }` in a
variable, pass it where `{ a: number }` was declared, satisfy `tsc`, and be
rejected by `validate`. That is the exact disagreement this epic exists to
remove, surviving inside its own deliverable. (The *tuple* kind has no such
gap: a TypeScript tuple is exact-length, so `Ts<>` renders a closed tuple
exactly — which is what stage 1 of
`option` as omission settled; both stages have landed.)

Two things keep this from undermining the whole direction, and both need
stating rather than assuming:

- **It is a boundary property, not a checker property.** Inside FunctionalScript
  the checker reads the schema itself, so closedness is enforced exactly and
  compile time and run time do agree. The gap exists only where a schema is
  projected into TypeScript for an outside consumer — commitment 5's audience,
  not commitment 1's.
- **The projection errs upward, and what that costs depends on the position.**
  A generated declaration is a supertype of the schema's set wherever
  TypeScript cannot express it exactly. In an **output** position — an exported
  const, a function's result — that is harmless: the value was produced by code
  the schema governs, so a wider declaration merely under-promises. In an
  **input** position it is not, and an earlier draft of this section claimed
  otherwise. `{ a: number }` on an exported parameter tells a TypeScript
  caller it may pass a variable carrying extra keys, and **nothing validates
  it**: no stage injects a check at a package call boundary, so the callee
  receives a value outside its schema silently. "Caught loudly at the
  validation boundary" is true only where such a boundary exists, and for a
  plain exported function it does not.

  This is contravariance arriving early — the same axis stage 7 must introduce
  for function schemas, showing up first in what a declaration promises rather
  than in `subset`.

**`rest(c, r)`** is the second, and it is not fixed by fixing the first.
TypeScript requires an index signature to cover the declared keys too, so the
printer widens the index type "to the union of the rest and the declared value
types — the closest expressible supertype"
([`rtti/ts`](../fjs/rtti/ts/module.f.mjs)). `rest({ a: number }, string)`
therefore emits an index of `number | string`, and a caller may pass
`{ a: 1, b: 2 }` — a numeric extra key, which the schema rejects because its
rest is `string`. Note that an exact-key encoding for the bare, closed form
would **not** rescue this: the problem here is not the absence of exactness but
that TypeScript cannot hold "these keys at these types, all *other* keys at
that type" as two separate constraints.

**Non-finite numbers and `-0`** are the third, and they are smaller only in
how often they appear. The printer renders a numeric const as
`isFinite(c) ? String(c) : 'number'`
([`fjs/types/ts`](../fjs/types/ts/module.f.mjs), which
[`rtti/ts`](../fjs/rtti/ts/module.f.mjs) imports), so a `NaN`,
`Infinity`, or `-Infinity` const becomes the type `number`, and `-0` becomes
the literal `0`. Validation meanwhile uses `Object.is` **on purpose** — its doc
comment says so, precisely to match `NaN` and to keep `+0` and `-0` distinct
([`rtti/common`](../fjs/rtti/common/module.f.mjs)). So a `NaN` schema in
an exported input position admits any number and rejects all but one, and a
`-0` schema admits `+0` and rejects it. TypeScript has no `NaN` literal type
and does not distinguish `-0` from `0`, so this is inexpressible in the same
way a closed struct is, and it lands the same way under the position split above:
under-promising on output, unsound on input.

What this needs is a **stated policy**, decided before stage 11 rather than
discovered by a consumer:

1. narrow the promise — say plainly that a `.d.ts` is an upper bound, and that
   exactness lives in the schema. **Adequate only in output positions**; in an
   input position it documents a hole rather than closing one, so it has to be
   paired with a boundary wrapper. Note that the wrapper 668 proposes
   (`validateFunc`) returns `Result<…>`, which changes the published signature
   — and so collides with stage 11's rule that a retiring declaration must
   reproduce what it published. Whichever way this goes, those two decisions
   are one decision; or
2. restrict closed structs and stated rests in exported contracts, so published
   types are ones TypeScript can express; or
3. emit an exactness encoding where one exists (a branded field, an
   `Exact<T>` helper), accepting its ergonomic cost.

None is obviously right, and the choice is a promise to consumers rather than an
implementation detail, so this epic records it rather than picking.

**None of the three covers the numeric cases, either.** Option 2 is written
about object shapes; option 3 says "where one exists", and for these it does not —
TypeScript has no `NaN` literal type and does not distinguish `-0` from `0`, so
there is nothing to encode. A `NaN`, `±Infinity` or `-0` schema in an **input**
position therefore needs a boundary adapter under every policy, not just under
option 1. Anywhere this file says options 2 and 3 leave nothing to adapt, read
it as scoped to the object shapes TypeScript can name.

### What already exists

| Piece | Where | State |
| --- | --- | --- |
| Schema constructors | [`fjs/rtti/module.f.mjs`](../fjs/rtti/module.f.mjs) | done |
| Run-time checking | [`parse/`](../fjs/rtti/parse/module.f.mjs), [`validate/`](../fjs/rtti/validate/module.f.mjs) | done — same acceptance, differing only in what a success carries. `data`'s reader is **not** a third with the same acceptance: see [data-validate-admits-non-djs-values](../fjs/rtti/todo/data-validate-admits-non-djs-values.md) |
| Canonical data form, `subset` | [`data/`](../fjs/rtti/data/module.f.mjs) | done, and **sound but deliberately incomplete** — it never answers `true` for a non-inclusion, and may answer `false` for one that holds only semantically. The primitive a checker needs, not the whole of assignability |
| TypeScript emission | [`ts/module.f.mjs`](../fjs/rtti/ts/module.f.mjs) | done as a printer — but it and `Ts<>` disagree on `unknown` and on tuple openness, by its own doc comment, so it is not yet a faithful `.d.ts` generator |
| Compile-time bridge | `Ts<T>` in [`ts/types.ts`](../fjs/rtti/ts/types.ts) | done, and transitional — see Problem |
| Annotation convention | — | not started |
| Compile-time evaluation | [`fjs/fsc/todo/047-fsc-meta-programming.md`](../fjs/fsc/todo/047-fsc-meta-programming.md) | not started |
| Inference | [type inference](../spec/todo/3370-type-inference.md) | not started — most of the work |
| Function schemas | [668-rtti-function-types](../fjs/rtti/todo/668-rtti-function-types.md) | not started — and **nearly half** the tree's JSDoc type bodies are function types (~46% when measured in review of #1719; counts drift, so re-measure rather than cite this), so it gates a large share of stage 11 |
| Generic schemas | the eDSL itself | **value layer done** — a schema-to-schema function needs no feature; only `.d.ts` / `Ts<>` rendering is missing |

More than half the run-time and emission side is built. The compile-time side is
the part that does not exist.

### What a compile-time-only type costs

The standing objection to types-as-values is cost: TypeScript erases its types,
and a type that is an ordinary value looks like one more thing to ship. It does
not apply here, and answering it needs no erasure rule.

A FunctionalScript module compiles to an [EDAG](./edag-spec.md), and source is
serialized back **out of the graph**, by reference count, emitting only what is
reachable —
[`fjs/djs/serializer`](../fjs/djs/serializer/module.f.mjs) already does exactly
this for DJS values, counting references, hoisting shared ones to `const cN`,
and emitting nothing for what nothing points at. A schema imported and named
only to be mentioned in `//: myType` annotations has no edge from anything the
program evaluates: the annotation is a comment, the compiler consumed it at
compile time, and no node refers to the binding, so **the schema is not built in
the shipped program** — subject to one unsettled question about the *import*
itself, below.

The same schema passed to `validate` *is* referenced, so it stays — once, shared
by both uses, because the graph deduplicates by identity rather than by import
site.

Three things follow:

- **No `import type`, and no erasure rule.** Reachability already answers the
  question, so the language needs no second import form, no annotation
  distinguishing type imports from value imports, and no specification of which
  constructs vanish. One import, one binding, and the graph decides.
- **The two cannot disagree.** In a language with a separate type-import form,
  marking something `type` that is needed at run time is a whole bug class.
  Here the emitted program is a function of the graph, so "reachable at run
  time" and "kept" are the same statement.
- **Pay for what you check** — with the anchoring caveat below. A module whose
  schemas are local and total ships no
  schema at all; one that validates a protocol frame ships exactly the schemas
  it validates; a module doing both ships one copy.

**Within a module** the drop is sound by the EDAG's own rule, not merely
convenient. [edag-stage1-discussion](./edag-stage1-discussion.md) establishes
that throwing is the only effect, and that "nodes proven total are freely
movable and droppable" — it is precisely nodes that might throw that cannot be
dropped silently. RTTI schema construction builds immutable values and has no
failure mode, so a schema node is total by construction and meets that
condition.

**Across a module boundary it is not settled, and this epic does not get to
assume it.** Proving the schema constructor total says nothing about the root of
the module the schema was imported from: the transpiler evaluates every imported
module before the importing body, even when the binding is never referenced, so
an import whose module has a throwing top-level computation is observable
precisely by throwing. Dropping such an import would delete a failure from the
program. [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md)
is explicit about it and takes the conservative branch: Stage 1 **rejects** a
source module when an import parameter is not reachable from the module EDAG
root — "deliberately a reachability rule, not an effect analysis" — until the
EDAG has the anchoring operation that can preserve a non-resulting computation.

An annotation-only import is exactly that shape. So, stated honestly:

- **within a module**, an unreferenced schema node is dropped **when the whole
  initializer expression is total** — every subexpression, not just the
  outermost call. The RTTI constructors build immutable values and cannot
  throw, so an initializer made only of them is total and total nodes are
  droppable. Classifying by the outer constructor is not enough:
  `const t = array(makeType())` is "built from the RTTI constructors" by that
  reading, and JavaScript still evaluates `makeType()` first, so dropping the
  initializer can delete a throw. Nor does it extend to `const t = makeType()`,
  where the immutability of the result proves nothing about the call. The same rule
  that rejects unreachable imports applies inside the body — a potentially
  throwing entry must be preserved, and a module is rejected rather than have
  one discarded
  ([compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md)) — so
  an annotation-only local schema from such a call is in exactly the position
  stage 12 addresses. **Stage 12 covers both** — imported roots and local
  initializers — so the work is owned; what stays open is whether the local
  half is served by anchoring or by a totality analysis that can prove the call
  safe to drop;
- **across a module boundary, anchoring does not make it free** — it makes it
  *legal*. `,` "establishes all of its operands and takes the value of the last
  one; the earlier operands exist for their throw-potential only"
  ([`fjs/edag`](../fjs/edag/module.f.mjs)), so an anchored import root is
  retained and evaluated, precisely so its failure is not deleted. An
  annotation-only import from a module with expensive or throwing top-level
  work is therefore still shipped and still runs. Dropping it needs effect and
  totality analysis proving the *imported root* total — a different and larger
  thing than proving the schema constructor total, and nothing in this epic
  provides it;
- until then a module whose only use of an import is in annotations is one of
  the cases that rule rejects, and the epic owes it a resolution rather than an
  assumption — [stage 12](#tasks);
- the resolution is anchoring, not an exemption for schema modules. That
  `fjs/rtti/module.f.mjs` has no throwing top-level computation is true
  and is not a rule; a schema can be imported from anywhere.

Two further qualifications. This is a property of the FunctionalScript compiler
and its EDAG, so it arrives with them, not with today's `.f.mjs`-on-Node
execution, where importing the RTTI module is an ordinary run-time import. And
it says nothing about `.mjs`, which is ordinary JavaScript held to ordinary
bundler rules.

There is a pleasing closure here: `fjs/edag/` owns "the RTTI schema used to
define those types" ([edag-spec](./edag-spec.md)), so the graph that decides
what ships is itself described by the type system whose cost it decides.

### Editor support is part of the work, not an extra

Today a `.f.mjs` module gets its editor experience for free: VSCode runs the
TypeScript language service over the JSDoc, and hover, inline diagnostics,
go-to-definition, and completion all follow. **Stage 11 deletes that JSDoc.**
If nothing has replaced it by then, the editor goes dark at exactly the moment
the checker becomes real — which would be a worse day-to-day experience than
the one this epic set out to improve, no matter how sound the checker is.

So a **language server** (LSP, and so VSCode and every other LSP client) is a
precondition for stage 11 rather than a follow-on, and it is stage 10.
Commitment 2 is what makes the ordering achievable instead of a race: while both
annotation forms are present the TypeScript language service keeps working, so
the language server can be built, shipped, and adopted *before* any JSDoc is
removed.

Three of its features fall out of decisions already made:

- **Diagnostics.** The readers already produce `{ path, message }`. What is
  missing is a source span, which is [open question 4](#open-questions) — the
  same work, whether the consumer is a terminal or an editor.
- **Hover.** The name-only rule guarantees every annotated declaration has a
  type with a *name*, so hover has something to show, and `ts/module.f.mjs`
  already renders a schema to readable TypeScript for the expansion.
- **Go to definition, on a type.** An annotation body is an ordinary binding,
  so this is the same jump as any `const` — plain identifier resolution, not a
  type-language lookup. In a type grammar this is a bespoke feature; here it is
  the one that costs nothing.
- **Completion is not free**, and calling it "in-scope bindings whose value is
  a schema" — as an earlier draft did — hides the cost. Deciding whether
  `const t = makeType()` names a schema means *evaluating* it, and this
  document argues at length elsewhere that such an initializer may be
  expensive, may throw, or may not terminate. Doing that on a keystroke means
  running arbitrary workspace code inside the editor, or hanging it. Stage 10
  needs either static schema metadata it can consult without evaluating, or an
  explicit sandboxed-and-bounded evaluation policy. This is the same question
  as [open question 3](#open-questions), stage 5's well-formedness problem and
  stage 4's evaluation, arriving a fourth time: **nothing can tell a schema
  from a non-schema without either running it or having a meta-schema.**

The transport is largely built. LSP is JSON-RPC 2.0, and
[`fjs/protocol/json_rpc`](../fjs/protocol/json_rpc/module.f.mjs) already
implements the envelope, the standard error codes, and `dispatch`, with
[`mcp/stdio`](../fjs/protocol/mcp/stdio/module.f.mjs) as a working stdio server
to copy. Two pieces are genuinely new, and only one of them is small:

- **framing** — LSP uses `Content-Length` headers where MCP uses
  newline-delimited lines. Small.
- **notification dispatch** — `dispatch` returns `null` for any message without
  an `id` and never reaches a handler
  ([`json_rpc`](../fjs/protocol/json_rpc/module.f.mjs)), which is correct for
  JSON-RPC responses and wrong for a language server: `textDocument/didOpen`
  and `didChange` are notifications, and they are how the server learns the
  buffer's contents. Copied as-is, hover, diagnostics and completion would all
  run against a document the server never received. Executing notification
  handlers is stage 10 work, not transport it inherits.

It is also the natural dogfood. `json_rpc`'s own messages are RTTI schemas
today (`request`, `response`, `decodeRequest = parse(request)`), with its
`types.ts` derived by `Ts<>`; the LSP message types would be written the same
way, so the server that reports type errors is itself described by the type
system it reports for.

One known consequence elsewhere:
[error-message-specificity](../fjs/djs/tokenizer/todo/error-message-specificity.md)
parks "continue tokenizing after an error" as not worth doing "unless a real use
case (e.g. an editor/LSP wanting multiple diagnostics per file) shows up". This
is that use case — an editor that stops at the first token error is not usable —
so that issue's open question is answered yes by this stage.

### Non-goals

- **A type grammar.** Not a subset of TypeScript's type expressions, not a JSDoc
  dialect, not a new one. Commitment 1 is the whole point of the epic.
- **New FunctionalScript syntax.** `//:` and `/*: */` remain ordinary comments;
  only the RTTI layer interprets them.
- **Expressions inside an annotation.** Not even the language's own: the body is
  one name. A comment that can hold a call can hold a sub-language, and that is
  the road back to a type grammar. Give the type a `const` and use its name.
- **Describing mutable values.** RTTI has no writable member and is not getting
  one. A value becomes describable when it becomes immutable, which for
  ownership-tracked locals is the point it escapes
  ([mutability](../spec/todo/mutability.md)).
- **Typing `.mjs` with RTTI.** Ordinary JavaScript keeps TypeScript and JSDoc,
  and its mutation is exactly why.
- **Replacing `tsc` soon.** `tsc` and the standard toolchain are the checker
  until every stage below has landed, and turning them up as far as they go is
  the near-term work ([strict-static-analysis.md](./strict-static-analysis.md),
  [tsconfig-strict-flags.md](./tsconfig-strict-flags.md)). This is a
  non-goal that only works because the two annotation forms are disjoint
  (commitment 2): `tsc` keeps checking a file that has started to carry RTTI
  annotations, because it cannot see them.
- **Hand-written `.d.ts`.** Generated or absent.

### Tasks

**The numbers are labels, not a schedule.** They were assigned as this document
grew and have been renumbered twice; the gates below are the real order, and at
least one stage — 12 — has to land near the front. Renumbering again would
churn every reference in and out of this file for no gain, so the dependencies
are stated instead:

- **12 before 4.** Anchoring gates the first stage that *consumes* an
  annotation, not the one that recognizes it. Stage 3 adds a compile-time
  reference in parser output and changes nothing about the runtime graph;
  the rejection bites when that reference is erased while lowering to EDAG,
  leaving the binding unreachable from the root. So stage 3 is free to proceed,
  and stage 4 onward is not. It is numbered 12 of 13 and needed near the
  front.
- **1's renderer half** can start today; its declaration-emission half needs a
  schema for every export, so it waits for stage 6 or an explicit manifest.
- **3 onward** are gated on the compiler; **4 onward** additionally on
  compile-time evaluation ([`fjs/fsc/todo/047-fsc-meta-programming.md`](../fjs/fsc/todo/047-fsc-meta-programming.md)).
- **7 splits, and the halves sit on either side of 6.** 7 as one unit is a
  cycle: 6's general form needs a function case in RTTI, while 7's
  definition-checking needs the body's *inferred* result, which is 6. The seam
  is between representing a contract and checking against one — **7a**
  (the schema form, its place in the canonical algebra, the printer path, and
  whatever stage 4's stabilization needs of a function schema) gates the
  general form of 6; **7b** (static
  checking of readable definitions) consumes 6. So the order is 7a → 6 → 7b, and "7 gates 6",
  which this file said until review of #1719, is only true of 7a.
  Inferring a call to an *unannotated* function is not part of this cycle: it
  is ordinary recursion inside inference, and 6 owns its fixpoint.
- **7, 8, 9, 10 and 13 gate 11.** 7 was missing from this list until review of
  #1719 while two other places asserted it, and it gates 11 through both
  halves: without **7a** a function-typed export has no declaration to
  generate, so nothing can reproduce what its JSDoc published; without **7b**
  retiring that JSDoc leaves those definitions checked by nothing at all,
  which is not "TypeScript stops being the type system" but "no type system".
  Since function types are ~46% of the tree's JSDoc bodies, this is most of
  stage 11 rather than an edge of it.
- **10 overlaps 6–9** rather than following them, since it needs only stage 5's
  first diagnostic.

- [ ] **1. `.d.ts` generation from schemas.** An `fjs` command over
      [`ts/module.f.mjs`](../fjs/rtti/ts/module.f.mjs), wired into
      packaging ([publishing-packages](../fjs/ci/todo/publishing-packages.md)).
      No compiler work and no language change — but **not just a command**.
      The printer's own doc comment records two divergences from `Ts<>`. They
      are **not the same kind of problem**, and an earlier draft of this stage
      wrongly said both let a declaration admit values the schema rejects:

      - **`unknown` — the printer matches the runtime; `Ts<>` is the narrow
        one.** Both readers implement the `unknown` case as `() => ok`
        ([`validate`](../fjs/rtti/validate/module.f.mjs),
        [`parse`](../fjs/rtti/parse/module.f.mjs)), so the schema as
        *executed* accepts anything, functions and symbols included. The
        printer's TypeScript `unknown` says the same. It is `Ts<>` that maps to
        the DJS-shaped `Primitive | Array | Object` and so promises less than
        the schema delivers. **Do not "fix" this by emitting the DJS union:**
        that would make a declaration reject values the runtime accepts —
        reversing the mismatch rather than removing it. Reconciling `Ts<>` with
        the readers, or narrowing both readers deliberately, is the real
        question, and it is a decision about what `unknown` *means*, not about
        emission.
      - **Tuple openness — settled, and it went the other way.** A bare tuple
        schema is now *closed*, so the exact-length rendering `Ts<>` gives it is
        the model rather than an approximation of it, and the printer prints the
        same exact tuple. `open(c)` is what admits a longer array, and both
        renderers emit the tail that says so. This bullet used to record a live
        divergence and no longer does; stage 1 of `option` as omission
        (landed, both stages) removed it.

      **A third disagreement runs the other way, and has narrowed.** `RestTs`
      ([`ts/types.ts`](../fjs/rtti/ts/types.ts)) now renders a stated
      rest's tuple tail, so the two agree on every rest a schema states
      directly. What is left is the *empty*-rest recognition: the printer goes
      through the data form and recognizes one semantically, while `RestTs`
      recognizes only the directly spellable `or()` and keeps the tail
      otherwise. On the object kind the printer still errs **wide** (an index of
      `number | string`, above) where `Ts<>` renders the declared fields alone.
      They are wrong in opposite directions there, which is worth knowing before
      anyone tries to reconcile them by moving one toward the other.

      **The other two divergences turn out to be the same shape**, and neither is fixed
      by changing the printer: in each case the printer agrees with what the
      readers accept and `Ts<>` is narrower. So stage 1 changes the printer for
      neither. What is left in both is **compatibility** — the previously
      published declarations came from `Ts<>`, so emitting the printer's form
      widens what callers may pass — plus, for `unknown`, a genuine open
      question about which of `Ts<>` and the readers is right. Compatibility is
      stage 11's, under its rule about reproducing what was published.

      **The `unknown` meaning question needs an owner with a gate, not just a
      home.** Its natural home is [`rtti`](../fjs/rtti/README.md) rather
      than this epic — but an earlier draft stopped there, and a question
      deferred without a gate is one stage 11 can walk straight past. Four
      sources disagree about what an exported `unknown` promises: the module
      and its README say DJS-compatible values; `Ts<>` excludes functions and
      symbols; the readers accept them
      ([`validate`](../fjs/rtti/validate/module.f.mjs) and
      [`parse`](../fjs/rtti/parse/module.f.mjs) both have
      `unknown: () => ok`); and the printer emits TypeScript's unrestricted
      `unknown`. Until one is chosen, an exported `unknown` has no settled
      published meaning — so **stage 11 cannot retire a declaration containing
      one** without either failing its own reproduce-what-was-published rule or
      picking the answer implicitly, as a consumer-visible widening nobody
      decided. Recorded in the stage 11 table as a blocked category so it
      cannot be skipped.

      That symmetry is worth stating because two rounds of review corrected
      this stage in opposite directions before it appeared. Anyone re-scoping
      stage 1 should start from the readers' behaviour, not from `Ts<>` or the
      printer's doc comment.

      A further gap is **not** settleable, and belongs in a different column.
      The closed `{ a: number }` prints as `{ readonly a: number }`, and `Ts<>`
      renders it identically, because — in the printer's own words —
      "TypeScript object types are structurally open, so 'and no other key' has
      no spelling there". A consumer can hold a `{ a: 1, b: 2 }` in a variable,
      pass it against that declaration, and be rejected at run time by the
      schema that declaration came from. Unlike the two above, no emission
      choice fixes it: the set the schema denotes is not expressible in the
      target language. See
      [What a generated `.d.ts` can and cannot promise](#what-a-generated-dts-can-and-cannot-promise).

      **And it is not fully independent of the compiler stages.** The printer
      renders *a schema* to a type expression;
      [`dataToTs`](../fjs/rtti/ts/module.f.mjs) returns aliases plus that
      expression, not `export const ks: …`. Generating a module's `.d.ts` also
      needs to know **which export has which schema**, and that association is
      exactly what an annotation supplies — which does not exist until stages
      3–4. So stage 1 splits:
      - *independent, startable today* — schema → type expression, the
        `unknown` and tuple decisions above, and the `fjs` command around them;
      - *needs a schema for **every** export* — emitting a module's
        declarations. Annotation recognition is not enough: this design wants
        annotations **rare**, with inference carrying the burden
        ([type-annotations](../spec/todo/3360-type-annotations.md)), so after
        stages 3–4 a typical module has annotated exports and unannotated ones,
        and emitting only the former silently drops public API from the
        `.d.ts`. Partial input yields a partial declaration file, which is
        worse than none.

      That leaves three ways to close it, and one must be chosen rather than
      assumed: a **complete manifest** naming every export's schema; a rule
      that **every export is annotated** (in tension with keeping annotations
      rare); or **waiting for stage 6**, so inference supplies the schemas
      annotations do not. A manifest is the cheapest way to ship `.d.ts` output
      before the compiler exists; otherwise this half waits for stage 6, not
      stage 3.

      **Annotations are not sufficient even then, for a module that exports a
      schema.** `export const myType = or(number, string)` —
      [type-annotations](../spec/todo/3360-type-annotations.md)'s own example —
      is a case an annotation cannot describe: annotations say what *other*
      exports are, and `myType`'s own runtime value is an `Or` thunk, not a
      `number | string`. Emitting `dataToTs(myType)` would declare the
      represented type and misdeclare the value; omitting the export would
      delete public API a consumer needs in order to reuse the schema. Since
      schemas are values and this epic expects them to be shared and imported,
      this is the common case, not an exotic one.

      What it needs is a way to declare a schema's *own* type — a meta-schema
      describing `Type`, inference over schema-valued expressions, or a
      manifest that carries the export's runtime type alongside its schema.
      Whichever, it is stage 1 work and does not fall out of stages 3–4.
- [ ] **2. Settle the annotation form.** Narrow the body from an expression to a
      name in [type-annotations](../spec/todo/3360-type-annotations.md), and
      settle which positions accept an annotation — `const`, parameter, return,
      export — and what the line form attaches to.
- [ ] **3. Recognize `//:` and `/*: */` in the RTTI type-system frontend** from
      the tokenizer/parser comment stream and resolve the one identifier in the
      body against the module's bindings — under the scope rule stage 2 settles
      per [open question 2](#open-questions), since module-scope-only and
      "anything reducible" are different lookups. A distinct token kind is
      cleaner than inspecting the body's first character; neither adds a
      grammar, and neither needs the expression parser.
- [ ] **4. Evaluate an annotation at compile time**
      ([`fjs/fsc/todo/047-fsc-meta-programming.md`](../fjs/fsc/todo/047-fsc-meta-programming.md)) — the binding the name
      resolves to must be reducible to a schema value, and the error when it is
      not is a compile error.

      **"Evaluate" needs a bound and a sandbox here too, and an earlier draft
      required them only of stage 10.** That was inconsistent: the editor path
      and the compiler path run the same arbitrary workspace code, and this
      stage's is the one that has to produce the compile error above. An
      initializer — or an imported `.mjs` module reached through it — may not
      terminate, in which case compilation hangs *before* it can report
      anything; may throw, which must become a diagnostic rather than a
      compiler crash; and may be effectful, in which case it runs with whatever
      privileges the compiler has.
      [`fjs/fsc/todo/047-fsc-meta-programming.md`](../fjs/fsc/todo/047-fsc-meta-programming.md) does not state a policy
      today. So this stage needs the same answer stage 10 does — static schema
      metadata consultable without evaluating, or an explicit
      sandboxed-and-bounded evaluation policy — and it is the same question a
      **fourth** time, after stage 5's well-formedness problem,
      [open question 3](#open-questions), and stage 10's completion. Whoever
      answers it should answer it once, for the compiler and the editor
      together.

      **A schema must be stable across phases, and nothing yet requires that.**
      A `Thunk` is a function, `visit` calls it, and commitment 4 permits a
      schema to be imported from ordinary JavaScript — where its thunk or
      initializer may be stateful or nondeterministic. So stage 4 can evaluate
      a schema as `number`, emit a declaration from that, accept a program
      against it, and then `validate` can call the same thunk at run time and
      see `string`. Compile time and run time would disagree about what the
      type *is*, which is the one thing this epic exists to prevent, and no
      check anywhere would catch it.

      Two ways to close it. Require schema construction to be **provably pure
      and stable** — straightforward inside FunctionalScript, where there is no
      state, and not enforceable for a schema imported from `.mjs`. Or
      **serialize the compile-time schema for run-time use**, which is what
      `toData` already produces: a function-free canonical form that cannot
      re-evaluate to something else. The second needs no new analysis and makes
      the guarantee structural, so it is the one to beat.

      **But the snapshot only reaches the readers, and the thunk stays a
      first-class value.** A schema binding is an ordinary value: it can be
      exported, passed to user code, or handed to `validate(t)` by the program
      itself. Embedding a serialized snapshot for the compiler's use does not
      make any of those observe it — the original thunk is still there and can
      still re-evaluate differently. Closing that needs a semantics-preserving
      rewrite of **every** runtime use, and neither obvious rewrite is
      semantics-preserving: substituting the `Data` changes the type of the
      binding and breaks the `Type` API its consumers are written against,
      while reconstructing a fresh thunk from the snapshot changes observable
      identity — `Object.is` on two references to the same schema, and any
      memoization keyed on it.

      This is the strongest argument for the *first* remedy, and it is why the
      two are not simply cheaper-versus-dearer. **Purity is a property of the
      binding**, so it holds for every use of it at once; a snapshot is an
      artifact handed to particular consumers, so it holds only where it is
      threaded. If the snapshot route is taken, this stage owes an explicit
      statement of which uses it covers and what happens to the rest — not a
      claim that run time reuses it.

      **And the snapshot has to survive being written down.** Reusing the
      compile-time schema at run time means embedding it in the shipped
      program, which means serializing it — and
      [`data/README.md`](../fjs/rtti/data/README.md) states the corner
      itself: JSON's number model "writes a `NaN` literal member as `null` and
      drops `-0`'s sign, so a schema using those two as literal members does
      not round-trip textually today and needs a serializer that preserves
      them". It is shared by both serializers — DJS covers the rest of the form
      including `bigint` literals, but numbers go to `JSON.stringify`
      ([`json/serializer`](../fjs/media/json/serializer/module.f.mjs)). A
      snapshot of `{ x: NaN }` would come back as `{ x: null }`,
      so the run-time schema would differ from the one the compiler checked
      against — the exact disagreement this remedy exists to prevent, arrived
      at through the fix rather than the bug. So this stage needs a lossless
      number serializer, or an explicit restriction on the literal members of a
      snapshotted schema, before the remedy is sound. **The restriction has to
      cover every non-finite number, not just `NaN`** — `numberSerialize`
      delegates all numbers to `JSON.stringify`, which renders `Infinity` and
      `-Infinity` as `null` too, so `{ x: Infinity }` snapshots as
      `{ x: null }` exactly as the `NaN` case does. Plus `-0`, which is
      lost differently: it serializes as `0` rather than `null`. An earlier
      draft of this paragraph named only `NaN` and `-0`, while the printer
      paragraph above already said *non-finite* — the same slip in one file,
      one section apart.

      Note this is the **third** mechanism these values break, after the
      printer rendering a non-finite const as `number` and `-0` as `0`, and
      `validate` matching them with `Object.is` on purpose. Whoever picks up
      the `.d.ts` policy should treat non-finite numbers and `-0` as one
      question across all
      three rather than three unrelated corners.

      **And it only reaches one of the two readers.** Of `data`'s readers and
      comparisons — `toData`, `validate`, `subset`, `cmp`, `equal` — there is
      **no `parse`**, and no
      `Data`-to-`Type` reconstruction anywhere in the tree. So a snapshot can
      stabilize a `validate` call and cannot stabilize a `parse` one:
      [`parse`](../fjs/rtti/parse/module.f.mjs) takes the thunk-form
      `Type` and walks it, re-entering the thunk, while handing it the `Data`
      instead would change its signature. That is the reader this epic leans on
      hardest — stage 13's inbound remedy is "`parse` against a schema that
      names every part", and commitment 3's argument for reconstruction over
      freezing rests on it — so leaving `parse` unstabilized undercuts the
      boundary work rather than a corner of it.

      So this stage owes **one of two things, named rather than assumed**: a
      data-driven `parse` beside `data.validate`, or a `Data` → `Type`
      reconstruction that every reader can take. Either way it is a
      deliverable, not an implementation detail, because without it the phrase
      "run time reuses the snapshot" is only true of half the run time.

      **And neither path is free, because `Data` does not preserve what `parse`
      returns.** An earlier draft of this paragraph called the reconstruction
      "lossless" without saying lossless *of what*. `Data` is a canonical form
      of the **set of accepted values**; `parse`'s result is not a function of
      that set. `parse` reconstructs from the **first matching branch**, so
      branch order is observable in its output, and `toData` normalizes it
      away. Measured at `fd805961`:

      ```
      parse(or({ a: number }, { b: number }))({ a: 1, b: 2 })  ->  ok { a: 1 }
      parse(or({ b: number }, { a: number }))({ a: 1, b: 2 })  ->  ok { b: 2 }
      toData of the two                                        ->  identical
      cmp = 0, equal = true
      ```

      So a snapshot that round-trips acceptance perfectly can still change
      which value `parse` hands back, for any union whose branches overlap on
      the input. That is not a corner: **stage 13's inbound remedy is `parse`
      against a naming schema**, so the value the boundary reconstructs is
      exactly what would silently change.

      This stage therefore owes a third thing, and it is a genuine fork:
      either the snapshot **retains branch and reconstruction information**
      beyond canonical `Data` — in which case it is not `Data` and `subset`
      cannot consume it directly — or `parse` is **redesigned to canonical
      output semantics** and that becomes a deliberate, documented change to
      what it returns. Both are larger than "add a reader", and choosing
      neither means the snapshot quietly changes program behaviour.

      **It is not semantics-preserving today either, and that is a
      precondition, not a caveat.** Reusing the `data` form at run time means validating through
      `data`'s reader, and it accepts values the thunk readers reject:
      `unionValidate` dispatches on primitives and arrays and lets everything
      else fall through to object validation, while `validate` and `parse`
      guard object positions with `isObject`. Measured at `b47b1376`,
      `validate({})(() => 1)` is an error and
      `data.validate(toData({}))(() => 1)` is `ok`; the same holds for a symbol,
      and for `record(number)` in place of `{}`. It reaches further than vacuous
      patterns: `objectSetValidate` reads each declared property as `value[k]`
      without requiring an object, so `{ length: number }` and `{ name: string }`
      also diverge for a function, and `{ description: string }` for a symbol.
      `{ a: number }` rejects in both only because a function has no `a`. Swapping readers to fix *which schema* run time
      sees would change *what that schema accepts*, trading one compile-time /
      run-time disagreement for another. Nor is the repair a one-liner: for
      `unknown` the two readers *agree*, and agree only because of the same
      fall-through, so guarding it produces the mirror-image divergence. Filed as
      [data-validate-admits-non-djs-values](../fjs/rtti/todo/data-validate-admits-non-djs-values.md),
      which this stage is gated on.

      **It does not reach function schemas if stage 7a goes extern.** `data` is
      function-free by construction, so a function contract living outside it
      has nothing for `toData` to serialize and this remedy silently does not
      apply there. So **if** this stage takes the snapshot route, a canonical
      serializable form becomes a requirement on the extern option rather than
      a nicety — recorded as [stage 7](#tasks)'s fourth deliverable, which is
      conditional on this same choice — and it is a reason to prefer function
      contracts inside `data`.
- [ ] **5. Check literal right-hand sides** with `validate`. This is the first
      point at which the epic checks anything.

      **Check against stage 4's snapshot, not by re-entering the thunk.**
      `validate` walks the thunk graph, so `visit` calls the schema's thunk
      again — which means stage 4 stabilizing the schema does not reach this
      stage. A stateful imported thunk alternating between `number` and
      `string` hands `toData` one answer for the snapshot, the declaration and
      run time, and hands this stage the other for the literal check: the
      program is then compile-time-checked against a schema nothing else in the
      pipeline uses. Stage 4's remedy only holds if every later phase reads the
      *snapshot*, so this stage reads it too — which makes it depend on the
      `data` reader divergence being fixed first
      ([data-validate-admits-non-djs-values](../fjs/rtti/todo/data-validate-admits-non-djs-values.md)),
      since checking against the snapshot means checking with `data`'s reader.
      Requiring schema purity instead is the alternative, and it is the same
      choice stage 4 already records — decided once, for both stages.

      **It needs the schema itself checked first, and nothing yet does that.**
      `visit` assumes its input already satisfies the static `Type` contract:
      an unrecognized tag falls through to `v.primitive0(tag)`
      ([`rtti/common`](../fjs/rtti/common/module.f.mjs)), so a binding
      whose value is `() => ['wat']` is reducible, callable, and behaves as a
      type that rejects everything — rather than producing the "that is not a
      schema" compile error stage 4 owes. An always-failing type is the worst
      possible diagnostic: every annotated site fails, and none of them says
      why.

      So either stage 4 checks well-formedness when it evaluates a binding, or
      a meta-schema over `Type` is a prerequisite here. That is
      [open question 3](#open-questions) becoming load-bearing rather than
      speculative, and it wants deciding before the checker is written, not
      after.
- [ ] **6. Inference, then general right-hand sides.** Infer a schema for an
      arbitrary expression and ask `subset(inferred, declared)`. `subset`
      exists; the inference does not
      ([type inference](../spec/todo/3370-type-inference.md)). Most of the work.
      **Its general form is gated on stage 7a, not the other way round** — on
      the function *schema form*, not on stage 7b's checking of definitions,
      which runs the other way and consumes this stage.
      [type-annotations](../spec/todo/3360-type-annotations.md) uses
      `const a /*: t */ = f(x)` as the representative non-literal right-hand
      side, and inferring a call means having `f`'s contract and its result
      schema — which RTTI cannot hold until stage 7a gives it a function case.
      Since FunctionalScript modules are almost entirely functions, this is the
      common case rather than a corner. So either stage 7a runs before this one,
      or this one is explicitly narrowed to call-free, function-free
      expressions first and widened afterwards. Say which; do not leave the
      order implied by the numbering.
      **A `false` from `subset` is not a type error.** It is
      [sound and deliberately incomplete](../fjs/rtti/data/README.md#subset-is-sound-and-deliberately-incomplete):
      it never says `true` wrongly, but it says `false` for inclusions that hold
      only semantically — `readonly [number | string] ⊆ readonly [number] |
      readonly [string]` is the documented case, along with non-syntactically
      empty left sides and short array patterns. Rejecting on every `false`
      would reject valid programs. So this stage owes a third answer —
      `true` / `false` / *cannot decide* — which **today's API cannot express**:
      `subset` is `(a: Data) => (b: Data) => boolean`, so producing the third
      answer needs a tri-state API or a separate completeness witness before any
      policy can be applied. Then a policy for the third: accept
      with a run-time check, ask for an annotation, or complete the algorithm in
      the direction `data/README.md` names (semantic subtyping, CDuce-style).
      Deciding that is part of the stage, not a detail under it.
- [ ] **7. Function schemas**
      ([668-rtti-function-types](../fjs/rtti/todo/668-rtti-function-types.md)),
      and what an annotation on a function *means*. An earlier draft posed that
      as two choices — a compile-time check that cannot be completed, or a
      wrapper validating each call — and **that is a false choice**, inherited
      from a framing about runtime validation. It splits by provenance:

      - **A function defined in a compiler-readable module** is statically
        checkable, with no wrapper and no API change: check the body's inferred
        result against the declared result schema, and check each call site
        against the parameter schemas. This is ordinary type checking and it is
        what stages 5–6 already do for other values.
      - **An opaque function crossing a runtime boundary** — one arriving from
        ordinary JavaScript, or whose definition the compiler cannot see — is
        the case 668's wrapper is for, and the case where its `Result` return
        is justified.

      **The split is over definitions, and call sites split separately.** A
      readable definition makes the *body* checkable and every call site the
      compiler can see checkable with it; it says nothing about a call the
      compiler cannot see. An exported function called from outside the
      compiler's view is exactly that — readable definition, foreign call
      site — and
      [the `.d.ts` section](#what-a-generated-dts-can-and-cannot-promise) has
      already named the consequence: where the emitted declaration is *wider*
      than the schema (the closed-struct, `rest(c, r)`, and non-finite / `-0`
      cases),
      a consumer can pass a value its `.d.ts` accepts and the schema rejects,
      and "nothing validates it". A consumer in **ordinary JavaScript** is not
      bound by the declaration at all, so for that half the width of the
      declaration is beside the point. Either way, restricting wrappers to
      opaque functions is right about *why* the `Result`-returning wrapper must
      stay off ordinary exports, and would be wrong if read as "no readable
      export needs an entry check".

      **That path is stage 13's**, not a fourth deliverable here — it is a
      foreign call crossing the language boundary inbound, and stage 13 already
      owns the boundary in both directions and already says the closed-struct policy
      and 668's wrapper are one decision. What stage 13 owes there splits by
      call site: conditional on the `.d.ts` policy where the call was
      statically checked against the declaration, unconditional everywhere else
      — and the callee cannot tell which it got. Either way the adapter is not 668's
      wrapper as written: that wrapper returns `Result<…>` and so changes the
      published signature, which collides with stage 11's rule that a retiring
      declaration must reproduce what it published.

      668's limitation is that *runtime validation* cannot prove an arbitrary
      function's future behaviour. True, and it says nothing about statically
      checking a definition the compiler can read. Reading it as the general
      case would have forced the API-changing wrapper onto ordinary exported
      functions, or left the commonest case unchecked — either of which blocks
      stages 6 and 11 for most of the tree.

      **This stage is two halves with a gate between them, and stage 6 sits in
      the gap.** Checking a definition means checking "the body's inferred
      result against the declared result schema" — and that inference *is*
      stage 6, whose general form in turn needs the function schema form from
      here. Read as one unit this stage and stage 6 deadlock. The seam is
      between **representing** a contract and **checking against** one:

      - **7a — representation.** The schema form, its place in the canonical
        algebra, and the printer path (items 1–3 below). Needs no inference,
        and gates the general form of stage 6.
      - **7b — static checking of readable definitions.** The provenance split
        above. Consumes stage 6's inference, so it follows it.

      The runnable order is **7a → 6 → 7b**. Nothing else in the file depends
      on 7's two halves landing together, and stage 11 waits for both anyway.

      **Adding the schema form is necessary and not sufficient**, because
      everything downstream of it runs on the canonical `data` form, and that
      form is *function-free* by construction
      ([`data/README.md`](../fjs/rtti/data/README.md)). Stage 6 checks
      through `data`'s `subset`; stage 1's printer goes `toData → dataToTs`.
      668 itself contemplates an **extern** form that "may need to remain
      outside that core form" — and a schema outside it has no assignability
      and no declaration to emit, so function JSDoc still could not retire.
      This stage therefore owes four things, not one:

      1. the function schema form itself;
      2. a place in the canonical algebra — either function contracts inside
         `data`, or an equivalent `subset` path for extern schemas. Note this
         is where **variance** enters the epic for the first time: function
         inclusion is contravariant in parameters and covariant in results,
         and `subset` today is inclusion over kinds with no variance notion at
         all;
      3. a printer path, so a function-typed export has a declaration to
         generate;
      4. **whatever stage 4's stabilization strategy requires of a function
         schema** — conditional, because stage 4 leaves purity-versus-snapshot
         open. Under **purity**, a function schema has to be able to satisfy it
         and nothing needs serializing. Under the **snapshot**, it needs a
         canonical serializable form, which the extern option most easily
         fails: `data` is function-free by construction, so an extern function
         schema is exactly the thing `toData` cannot pin, and a stateful
         imported thunk could then yield one contract while the compiler checks
         and another when `validate` runs — the disagreement stage 4 exists to
         prevent, in the one part of the type language its remedy would not
         reach. An earlier draft stated this deliverable unconditionally, which
         presumed the snapshot had won.

      Whether 668's extern direction can carry 2, 3 and 4, or whether function
      contracts must go into `data` proper, is the decision that unblocks the
      function-typed JSDoc bodies — the ~46% measured in the table above — and
      it belongs in 668, so this stage is not done until 668 answers it.
- [ ] **8. Generic schemas.** A generic type is a function from schemas to
      schemas — `array` and `record` already are — so *writing and using* one
      needs nothing new. **Emitting a declaration for one does.** The printer
      walks a concrete schema graph, while a constructor like
      `pair = t => [t, t]` is an opaque function whose argument-to-result
      relationship is nowhere represented as data, and instantiating it at
      concrete types does not recover
      `<T>(t: Type<T>) => Type<readonly [T, T]>`. This stage therefore needs
      that relationship **reified** — a type-variable schema the constructor can
      be applied to symbolically, or an equivalent — and only then the
      `.d.ts` / `Ts<>` rendering.

      **Symbolic application works only if the constructor is parametric**, and
      commitment 1 as written does not require that. `t => t === number ?
      string : bigint` is a schema-to-schema function that *observes* its
      argument: applied to a synthetic variable it takes the `bigint` branch,
      while the real `number` instantiation yields `string`, so the emitted
      declaration would be confidently wrong rather than absent. This stage
      therefore has to either restrict exported generic constructors to
      parametric composition in the eDSL — a real narrowing of commitment 1,
      and worth stating there if chosen — or reify the operations and control
      flow that inspect a schema, which is a much larger thing. Pick before
      building; symbolic application is not a strategy on its own. Also confirm that naming every instantiation
      (`const keys = array(key)`), which the name-only rule requires, does not
      become noise across the tree's `@template` uses.
- [ ] **9. Nominal types.** [`fjs/types/nominal`](../fjs/types/nominal/module.f.mjs)
      has no RTTI representation: either RTTI gains a brand-carrying wrapper, or
      nominal types stay a TypeScript-era construct
      ([134-nominal-types-proposal](./134-nominal-types-proposal.md)). Gates
      stage 11 for every declaration with a nominal public type — branding is a
      compile-time fiction (`asNominal` is `identity`), so nothing in the value
      carries it and a generated `.d.ts` cannot recover it.
- [ ] **10. A language server.** LSP over
      [`json_rpc`](../fjs/protocol/json_rpc/module.f.mjs) — diagnostics with
      spans, hover, go-to-definition, completion — so that removing JSDoc does
      not remove the editor experience. Must ship *before* stage 11, and can
      start once stage 5 produces its first real diagnostic — so it overlaps
      stages 6–9 rather than following them, the one place the numbering is a
      dependency order and not a schedule.
- [ ] **11. Retire `Ts<T>`, the JSDoc types in every compiler-readable
      FunctionalScript module — `.f.js`, and a `.f.mjs` only once it has been
      renamed to `.f.js` — and the `types.ts` beside them.**

      **"Once the parser accepts it" is the wrong test, and an earlier draft of
      this heading used it.** It disagreed with this file's own readability rule
      above — "the rename to `.f.js` is exactly the event that says it can" —
      and with the source migration, which makes its `.f.mjs` -> `.f.js` stage
      a prerequisite rather than a parallel track. The
      difference is not pedantic: an authored `.f.js` is a **compatibility
      commitment** the parser must keep
      ([`fjs/fsc/README.md`](../fjs/fsc/README.md)), while a `.f.mjs` that the
      parser happens to accept today carries no such promise. Retiring JSDoc on
      the strength of "it parses right now" leaves the module checked by
      nothing the first time that stops being true — and nothing would flag it,
      because the JSDoc it would have fallen back on is gone.

      **Retirement has two granularities, and they are not the same.** Removing
      a declaration's JSDoc is *per-declaration*: the two annotation forms are
      disjoint, so a module can carry both, one, or neither, with no flag day.
      Switching where a module's `.d.ts` comes from is *per-module*, because
      the artifact is. A mixed module — some declarations retired, some not —
      has no source for a complete one: `tsc` cannot see `//:` and so cannot
      emit a retired declaration's contract, and the generator knows only
      schemas, while stage 1 rules that a partial `.d.ts` is worse than none.

      So one of two things has to be true, and this stage must say which:
      either the generator can **merge** — schema-generated contracts for
      retired declarations, `tsc`-derived ones for the rest, in one file — or
      the `.d.ts` switch is **module-at-a-time** even while the source edits
      stay per-declaration, meaning a module's JSDoc all goes at once or none
      of it does. The merge is more work and keeps the incremental property
      that made per-declaration attractive; module-at-a-time is simpler and
      gives up that property for `.d.ts`-publishing modules.

      **One rule governs the whole stage: a declaration retires only when the
      generated `.d.ts` reproduces what it published.** Not "when a schema
      exists for it" — when the emitted declaration means the same thing.
      Anything else silently changes a published API, and does it in the
      artifact consumers actually read.

      That rule is necessary and **not sufficient**. It preserves the published
      API; it does not by itself deliver the schema/declaration agreement the
      epic promises, because a declaration can be reproduced faithfully and
      still be wider than the schema — the closed struct is the standing case, and the
      old and new declarations there are identical *and* both wider. Retiring
      such a declaration is safe for consumers and still leaves the gap
      [the `.d.ts` section](#what-a-generated-dts-can-and-cannot-promise)
      describes, which is why that section asks for a policy before this stage
      runs.

      Six categories are known not to satisfy that rule today. The list is
      **open**: assume there are more until someone enumerates `types.ts`
      exhaustively.

      | Category | Example | Blocked on |
      | --- | --- | --- |
      | Nominal / branded | `Vec = Nominal<'bit_vec', _Revision, bigint>` ([`bit_vec`](../fjs/types/bit_vec/types.ts)) | stage 9 — branding is a compile-time fiction, so nothing in the value carries it |
      | Generic schema constructors | `pair = t => [t, t]` | stage 8 — the argument-to-result relationship must be reified first |
      | Type-only utilities | `Index`, `Tuple`, `KeyOf`, `Includes` ([`types/array`](../fjs/types/array/types.ts)) | **nothing yet** — these describe no runtime value, so no schema and no printer produces them |
      | Polymorphic functions | `identity: <T>(value: T) => T` ([`types/function`](../fjs/types/function/module.f.mjs)) | **nothing yet** — a function schema with concrete parameter and result sets cannot say both positions share one caller-chosen type |
      | Unsettled `unknown` | any exported schema containing `unknown` | **a decision, not a stage** — the module/README, `Ts<>`, the readers and the printer disagree about what it promises; see stage 1 |
      | Inexpressible sets | the closed `{ a: number }`; `rest({ a: number }, string)`; a non-finite or `-0` const | **the policy above**, not a stage — TypeScript cannot name these sets, so the declaration is an upper bound however it is emitted |

      **Type-only utilities** and **polymorphic functions** have no stage
      assigned, and that is the honest state: a type-only utility is not a
      schema of anything, and RTTI has no type variables, so neither `.d.ts`
      generation nor stage 8's reification reaches them. Either the eDSL grows
      a representation (commitment 1 says that is where such gaps get closed)
      or those files are **explicitly retained** and the stage's claim narrows
      accordingly. Pick one before starting; do not discover it per module.

      The last two rows are not stages either, but for a different reason:
      each is a **decision** someone has to take — what an exported `unknown`
      promises, and which `.d.ts` policy wins — and neither can be deferred
      past this stage without deciding it by accident.

      Convert against a declaration comparison rather than against both
      checkers accepting the initializer, since they agree on a value without
      agreeing on a type — but compare against **the declaration that will
      actually be emitted**, not against `Ts<>`. A bare
      `Assert<Equal<Ts<typeof schema>, Declared>>` passes for an exact tuple
      declaration and the generated `.d.ts` then widens it, because the printer
      emits the open form where `Ts<>` renders the closed one. Either this
      check runs against emitted-declaration semantics, or stage 1 first makes
      `Ts<>` and the printer agree.

      A `types.ts` goes when every declaration in it retires under the rule
      above and nothing outside still imports it — **and that is not sufficient
      for a published module.** The package has no `exports` map and ships
      `**/*.d.ts`, so `types.d.ts` is a public subpath: emitted declarations
      reference `…/types.ts` specifiers, and
      [packed-consumer-validation](../fjs/ci/packed-consumer-validation.md)
      exists to prove those resolve to the shipped `types.d.ts` on every
      consumer toolchain. Deleting the file removes that subpath even when
      every declaration in it is reproduced elsewhere, which breaks a consumer
      that imports it by path. Retirement therefore needs either a
      compatibility `types.d.ts` that re-exports from the generated
      declarations, or an explicit, declared breaking change —
      "no internal importer" is a necessary condition, not the whole one. This is the stage where
      TypeScript stops being the type system for FunctionalScript — for the
      declarations it can reach.
- [ ] **12. Anchor every unreachable non-resulting computation an annotation
      leaves behind** — both **imported module roots** and **local
      initializers** — so that an annotation-only schema neither is rejected
      nor silently deletes a failure. This is the `','` anchoring operation
      [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md)
      defers, read from this epic's side. It makes such a schema **legal**, not
      free: an anchored computation is still evaluated, which is the point of
      anchoring.

      **This is a prerequisite, not a side quest, and an earlier draft of this
      file said otherwise.** The rule in
      [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md)
      *rejects* a module whose import parameter is unreachable from the EDAG
      root, and equally requires a potentially throwing body entry to be
      preserved rather than discarded. Once the compiler consumes an
      annotation, a binding used only to name or build that annotation's schema
      is exactly that — so such a module does not compile, which is a gate on
      stages 4–5 and on stage 11 — **not** stage 3, which only records and
      resolves the annotation — and not a question of runtime cost.

      Both halves bind where the use is annotation-*only* — a module that also
      passes the schema to `validate` keeps it reachable and is unaffected.
      **The totality exemption applies to locals only.** An initializer built
      entirely from the RTTI constructors is droppable without anchoring,
      because droppability there is a property of the node. The import rule is
      not an effect analysis and says so: it rejects on *reachability*, so an
      annotation-only import is rejected even when the module it names is
      wholly total, and nothing in the compiler establishes that totality
      across a module boundary anyway. Exempting total imports would need that
      cross-module analysis first. What is left is an
      annotation-only import, or an annotation-only local whose initializer
      contains a call — `const t = array(makeType())` included, since the
      argument is evaluated first. Until this lands, such a module must keep a
      runtime use of the schema alive — a wart, and worth naming as one — or
      keep the JSDoc it was going to retire.

      An alternative to anchoring the local half is a totality analysis that
      can prove the initializer safe to drop. That is a different and larger
      piece of work; whichever is chosen, one of them owns this.
- [ ] **13. Ownership at the language boundary.** Decide and implement what
      happens to a reference crossing between FunctionalScript and ordinary
      JavaScript in either direction, per
      [What a generated `.d.ts` can and cannot promise](#what-a-generated-dts-can-and-cannot-promise)
      and the boundary paragraphs above: `parse` against a fully naming schema,
      a deep copy, a **recursive** freeze — shallow `Object.freeze` seals only
      the outer container and establishes nothing, see the boundary paragraphs
      for why that makes reconstruction the better default — or an
      **enforceable** ownership transfer —
      inbound, and the mirror of it outbound, where an exported schema object
      is the sharp case. Enforceable is the operative word: a transfer that is
      merely *documented* establishes nothing, since an ordinary JavaScript
      caller can keep an alias and TypeScript accepts a mutable value where a
      readonly input is expected. Either the language gains the ownership
      tracking [mutability](../spec/todo/mutability.md) already contemplates —
      which is the only mechanism in sight that could make a transfer
      checkable — or the remedy is reconstruction or recursive freezing, which
      do not depend on the caller's cooperation. The closed-struct policy and 668's call-validating wrapper are the same
      decision seen from two angles, so settle them together.

      **`parse` is not fit for a hostile boundary today, and this stage cannot
      be planned until someone investigates what it would take.** Three
      measured facts, all reproducible, none of them designed here:

      - a cyclic foreign value overflows the stack rather than being rejected —
        `const t = () => ['array', t]` with a self-referential array gives
        `RangeError: Maximum call stack size exceeded`;
      - `parse` flattens shared references, changing the hash of a value whose
        sharing is part of its meaning
        ([identity-aware-parse](../fjs/rtti/todo/identity-aware-parse.md),
        which already owns this);
      - `validate` costs time exponential in sharing depth, which that same
        issue classifies as a DoS vector against untrusted input. Its recorded
        figure is 509 ms for a 19-array value; absolute timings vary by more
        than an order of magnitude across machines, so the growth rate is the
        claim, not any particular number.

      A naïve deep copy shares the first two. **The scope of the fix is the
      open question**: whether these are three defects or one missing
      capability (input-keyed identity tracking would address all three), what
      it costs, and whether the boundary should reconstruct at all rather than
      reject. That belongs in an investigation with the readers in front of it,
      not in this document.

      **Foreign calls into readable exports are in scope here**, and are the
      case most easily missed, because stage 7's provenance split makes their
      *definitions* statically checkable and so reads as if nothing is left to
      do. A TypeScript consumer calling an ordinary exported function is a
      foreign call site, and where the emitted declaration is wider than the
      schema — a closed struct, `rest(c, r)`, non-finite / `-0` — it can pass a
      value
      the declaration accepts and the schema rejects.

      **This splits by call site, and only one half is conditional.** An earlier
      draft of this paragraph said the `.d.ts` policy decides whether the stage
      owes an entry check at all — that options 2 and 3 close the hole in the
      declaration and leave nothing to adapt. That is true of a **TypeScript**
      consumer and false of an **ordinary JavaScript** one, which no
      declaration binds. A raw JavaScript caller passes a string to a
      `number` parameter, or a malformed object to a closed struct, whatever the
      `.d.ts` says; so do a TypeScript caller reaching the export through
      `any`, a `@ts-ignore`, or a dynamic property access. A declaration
      constrains a consumer who type-checks against it and nobody else.

      **The line is drawn at the call site, not at the consumer's language.**
      An earlier draft of these bullets split by consumer — TypeScript
      conditional, JavaScript unconditional — which contradicts the sentence
      immediately above it: a TypeScript consumer reaching the export through
      `any`, a `@ts-ignore`, or a dynamic property access is unchecked too, and
      would have fallen in the conditional half. What matters is whether *this
      call* was statically checked against the declaration:

      - **Statically checked call sites** — conditional, but on less than an
        earlier draft claimed. Options 2 and 3 make the declaration exact *for
        the shapes TypeScript can name*, and that buys exactly one thing:
        the argument was a member of the schema's set **at the moment of the
        call**. Two holes survive it, and both are this stage's:
        - **Numeric singletons.** Option 2 restricts closed structs, and option 3
          needs an encoding to exist — TypeScript has no `NaN` literal type and
          cannot distinguish `-0` from `0`, so neither option reaches a `NaN`,
          `±Infinity` or `-0` schema in an input position. Those need an
          adapter under *every* policy.
        - **Ownership of a retained reference.** An exact `.d.ts` proves
          membership, not ownership. A checked caller passing a mutable object
          or array to an exact `readonly` parameter keeps its alias and can
          mutate after the callee retains it, because `readonly` in TypeScript
          constrains the callee's use, not the caller's. So any retained
          reference still needs reconstruction, recursive freezing, or
          enforceable transfer — checked call site or not.

        What is left as genuinely conditional is narrow: a *non-retained*
        argument of a shape TypeScript can name exactly. Option 1 leaves even
        that open and needs an adapter.
      - **Every other call site** — **unconditional**: raw JavaScript, `any`,
        `@ts-ignore`, dynamic access, `eval`, a call from a consumer who simply
        does not run `tsc`.

      **And the callee cannot tell the two apart**, which is what makes the
      unconditional half dominate rather than merely coexist. Nothing at run
      time distinguishes an argument that arrived through a checked call from
      one that did not, so this stage owes a stated policy for arriving values
      regardless of which `.d.ts` policy wins: validate at entry, or declare
      the boundary explicitly untrusted and say what a FunctionalScript
      function may assume about its arguments.

      **"Validate at entry" is gated on the reader work above**, not merely
      informed by it: the exponential-in-sharing cost is reachable by an
      *acyclic*, well-typed foreign argument, so a cycle guard alone does not
      cover it. The second is a legitimate
      answer — it is roughly what the language does today — but it has to be
      *chosen*, because commitment 3's soundness argument is about what the
      language guarantees, and an unchecked foreign call is outside it. The
      conditional half then decides only whether a *checked* call needs
      adaptation on top of that policy.

      In neither case can the adapter be 668's `Result`-returning wrapper on an
      ordinary export, which would change the published signature that stage 11
      requires be reproduced.

      **The general form of the error is worth stating once**, because this
      file made it three times in a row while review of #1719 was in flight:
      that a readable *definition* leaves nothing to enforce; then that an
      exact *declaration* does; then that being written in *TypeScript* makes a
      consumer a checked one. All three confuse *knowing the right type* with
      *something checking it*. A `.d.ts` is a description that a consumer may
      opt into checking against; it is never an enforcement mechanism, nothing
      in this epic makes it one, and the callee cannot observe whether anyone
      opted in. Enforcement at this boundary is whatever the callee does with
      the value it was handed — nothing else on the outside counts.

      **Gates stage 11.** Retiring JSDoc does not create this hole, but it
      removes the last thing that documents the intended shape at the boundary,
      and commitment 3's soundness argument assumes an answer this stage has to
      supply. Without it stage 11 can complete while ordinary JavaScript can
      still mutate a value the checker relied on.

### Open questions

1. **Qualified names.** Is `ns.myType` a name or a member access? It reads as
   one name to a person and is a property lookup to a parser, and the answer
   decides whether a module using a namespace import
   ([namespace-import](../spec/todo/2220-namespace-import.md)) must add a named
   import just to annotate. Allowing a dotted name is the one relaxation worth
   considering; allowing it to be *general* member access is not.
2. **Whether to relax which bindings qualify.** Commitment 2 states the
   restriction — a module-level `const` or `import`, nothing else — and that is
   the default this epic commits to, not an open choice; an earlier draft of
   this question asked it as though the commitment had not been made, which
   left the two passages giving implementers incompatible rules. What is open
   is only whether to **widen** it later to anything the compiler can reduce.
   A name is not automatically compile-time known just because it is a name, so
   widening buys less than it looks like it does.

   **This must be settled in stage 2, before stage 3 starts.** Stage 3 resolves
   the identifier against the module's bindings, and the two answers are
   different lookups: module-scope only, versus one that must handle nested
   scopes and non-`const` bindings. Deciding it after the parser work would
   mean redoing it.
3. **Schemas that are themselves checked.** The value a name resolves to is an
   ordinary value in the same module system; whether it is checked against
   `Type`'s own schema, and what that costs, is unanswered.
4. **Error reporting.** A failed check is a `{ path, message }` from a run-time
   reader. What that looks like as a compile-time diagnostic — with a source
   span, and with the type's *name* in it, which is one thing the name-only rule
   buys — is undesigned.
5. **Cost.** Every annotation reaches a module evaluation. A name makes the
   cache key obvious — the binding — but whether the compiler memoizes schemas
   across a build is still open.
6. **Annotation-only imports.** Until imported roots can be anchored (stage 12),
   what should the compiler do with a module whose only use of an import is in
   annotations — reject it, as Stage 1's reachability rule does today, or keep
   the import and pay for it? Rejecting is safe and unhelpful; keeping it makes
   the cost claim conditional on the module imported from. Note that anchoring
   settles the rejection, not the cost: dropping an anchored root additionally
   needs it proven total.
7. **Ownership-tracked locals.** A local mutable object
   ([mutability](../spec/todo/mutability.md)) has no RTTI type while it is still
   mutable. Whether it may be annotated at all — with the schema its escaped
   form will satisfy — or simply cannot be, is undecided, and it is the one
   place the two designs touch.

### Related

The issues this epic subsumes or coordinates. Each stays its own file; this one
does not replace them.

**Core — the epic is these three.** They are *not* in the order listed: 668
splits around inference, so the runnable order is 668's representation half
(7a) → inference (6) → 668's checking half (7b), per
[the gates](#tasks). Listed here by subject rather than by schedule.

- [type-annotations](../spec/todo/3360-type-annotations.md) — the annotation
  form, the tooling consequences, and the argument for why there is no type
  grammar. The design note for commitments 1 and 2; stages 2–5 land there. It
  states the annotation body as an ordinary expression handed to the expression
  parser; **this epic narrows it to a name**, and stage 2 is that edit.
- [type inference](../spec/todo/3370-type-inference.md) — annotations are only
  as useful as what can be inferred without them. Stage 6.
- [668-rtti-function-types](../fjs/rtti/todo/668-rtti-function-types.md) —
  RTTI cannot describe a function today, and FunctionalScript modules are
  almost entirely functions. Stage 7, and the first real test of "growing the
  eDSL is library work".

**Design background:**

- [141](../fjs/types/todo/141-universal-rtti-type-system.md) — the earlier, more abstract form of this idea:
  a `TypeSystem<T>` interface with `equal`/`subset`, and a parser recognizing
  `Ts<typeof t>`. `subset` shipped in
  [`rtti/data`](../fjs/rtti/data/module.f.mjs); the parser half is this
  epic.
- [types-for-fs.md](./types-for-fs.md) — why TypeScript's own type system is not
  the target: it cannot analyze mutable types soundly, which is the argument
  commitment 3 turns around. It also already sketches `const x = //: RTTI-TYPE`
  under "Benefits" — the annotation form of this epic, proposed there first.
- [new-pl.md § Type System](./new-pl.md#type-system) — the same idea one level
  out: type checking as an opt-in library rather than a language feature.
- [edag-spec.md](./edag-spec.md) — already specifies the EDAG with RTTI and
  *plans* a Rust generator from it — the issue is `Status: open` with none of
  its eight tasks done, one being "Implement a Rust code generator from RTTI
  schemas" — and the same schemas would feed both. It is also the mechanism
  behind the cost discussion: source is serialized out of the graph, so an
  unreferenced node is not emitted. **Not the same as free** — see
  [What a compile-time-only type costs](#what-a-compile-time-only-type-costs),
  which holds only for a local initializer that is wholly total. An annotation
  naming an *imported* schema keeps the anchored root, and if that root
  constructs or exports the schema, the schema ships and is evaluated.
- [edag-stage1-discussion.md](./edag-stage1-discussion.md) — "nodes proven total
  are freely movable and droppable", the rule a schema node satisfies **when
  its whole initializer is total**, which the RTTI constructors are and an
  arbitrary call is not.
- [serialization](../spec/todo/serialization.md) and
  [compile-modules-to-edag](../fjs/djs/todo/compile-modules-to-edag.md) — code
  as an FJS value, and the rollout that brings the above from DJS values to
  modules.
- [134-nominal-types-proposal](./134-nominal-types-proposal.md) — stage 9.

**Depends on:**

- [`fjs/fsc/todo/047-fsc-meta-programming.md`](../fjs/fsc/todo/047-fsc-meta-programming.md) — the compiler loading and
  running modules as meta-programming, which is what compile-time evaluation of
  an annotation *is*. **Stage 4 onward** needs it — stage 3 is comment
  recognition plus resolving one identifier against the module's bindings, which
  needs neither the expression parser nor compile-time evaluation.
- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — establishes the `.f.mjs` /
  `.mjs` / `types.ts` / `.d.ts` split that commitment 4 assigns type systems to.
  Its "`types.ts` may remain permanently" is permanence with respect to *that*
  migration; stage 11 here is what eventually retires them.
- [fjs-nanvm-integration.md](./fjs-nanvm-integration.md) — the path to a
  compiler that parses authored FunctionalScript.
- [`fjs/bnf/todo/layered-parser.md`](../fjs/bnf/todo/layered-parser.md) — the
  transducer stack the tokenizer work in stage 3 belongs to.
- [js-string-literals](../spec/todo/2460-js-string-literals.md) — the
  repository's own `.f.mjs` sources are not yet input the parser accepts.
- [namespace-import](../spec/todo/2220-namespace-import.md) — open question 1
  turns on it.
- [mutability](../spec/todo/mutability.md) — not a dependency: RTTI describes
  the immutable values that ownership tracking produces, never the mutable ones
  it tracks. Open question 7 is where the two meet.

**Affected, but standing on their own:**

- [strict-static-analysis.md](./strict-static-analysis.md) and
  [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) — the near-term work,
  unaffected. `tsc` remains the checker throughout.
- [eslint.md](./eslint.md) — its three proposed custom rules (inline `@type`
  cast, unknown JSDoc tag, type-predicate placement; it names no rule ids, and
  none exist yet)
  are **transitional**, and must not be used to justify building a
  TypeScript-type grammar.
- [inline-type-casts.md](./inline-type-casts.md) — **implemented**, not
  pending: its header records 273 of 357 sites removed or converted, with 84
  remaining and a reason given for each. Nothing here changes that work or is
  changed by it.
- [publishing-packages](../fjs/ci/todo/publishing-packages.md) — consumes stage
  1's generated `.d.ts`.
- [`fjs/rtti/ts/README.md`](../fjs/rtti/ts/README.md) — not an issue,
  but the record of what `Ts<T>` costs and why stage 11 exists.
- [rtti-parse](../fjs/media/json/todo/rtti-parse.md) — reading JSON text
  straight against a schema; the run-time side continuing to grow around the
  same source of truth.
- [identity-aware-parse](../fjs/rtti/todo/identity-aware-parse.md) —
  neither reader tracks input identity, so `validate` re-walks a shared subgraph
  once per incoming edge and costs time *exponential in sharing depth* (a
  19-array value at 509ms, ~14s by depth 22). Two limits on what that means
  here, both worth stating because it is easy to over- or under-claim:
  **`subset` is not implicated** — it is a function of two `Data` values, and
  the issue is about the readers over runtime values. **Two stages are exposed,
  differently.** For stage 5 it is a build-time cliff: a *fully inline* literal
  has no sharing, so the exposure is a literal that names other bindings
  (`const a = [1]` … `[a, a]`), which the EDAG deduplicates by identity —
  ordinary in compiled form. Not a hard prerequisite there, but a constraint
  stage 5 is under. For [stage 13](#tasks) it is the filed DoS itself, because
  "validate at entry" points this reader at untrusted public input, and that
  policy is gated on the issue.
- [checked-const-pin](../fjs/rtti/todo/checked-const-pin.md) — how a
  schema bound to a `const` pins its literal; open, no design agreed. It is the
  ergonomics of commitment 2's "write it as a `const` first".
- [excluded-string-values](../fjs/rtti/todo/excluded-string-values.md) —
  `Type` has no negation, so a set like "any string but these" is unsayable.
  A gap in the eDSL of exactly the kind commitment 1 says gets closed there.
- [`fjs/protocol/json_rpc`](../fjs/protocol/json_rpc/module.f.mjs) and
  [`fjs/protocol/mcp`](../fjs/protocol/mcp/README.md) — the transport stage 10
  builds on, and the precedent for describing a protocol's messages in RTTI.
- [error-message-specificity](../fjs/djs/tokenizer/todo/error-message-specificity.md) —
  its parked "continue after an error" is unparked by stage 10; an editor needs
  more than one diagnostic per file.
- [expression](../spec/todo/3410-expression.md) — **not** a dependency, which is
  the point of the name-only rule: an annotation body needs no expression
  parser. It stays a dependency of the *language*, not of this epic.
