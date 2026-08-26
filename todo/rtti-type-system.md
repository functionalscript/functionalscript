# RTTI as the type system

**Priority:** P3
**Status:** open

This is an **epic**: it states the destination and the order, and it owns no
code of its own. Each numbered stage below is, or becomes, an issue in its own
file; this one is where they are read together.

### Problem

A type in this repository is written more than once. The same shape is a JSDoc
`@typedef`, a declaration in a sibling `types.ts`, and — where a value has to be
checked at run time — an [RTTI](../fjs/types/rtti/README.md) schema. Nothing
keeps the three in agreement: `tsc` checks the first two against the code and
the third against nothing, so a schema and its `@typedef` drift silently, and
the drift shows up as a value that type-checks and fails validation, or the
reverse.

The bridge that exists runs the wrong way. `Ts<T>`
([`fjs/types/rtti/ts/README.md`](../fjs/types/rtti/ts/README.md)) maps a schema
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

**RTTI is the single source of truth for both compile-time and run-time type
verification of FunctionalScript.** One schema, written once, is what the
compiler checks against, what `validate`/`parse` check against at run time, and
what a published `.d.ts` is generated from.

Five commitments make that concrete.

#### 1. Types are values, written in the RTTI eDSL

There is **no type language to invent**. A type is an ordinary expression —
written in the language, in a `const`, never in a comment — built from
[`fjs/types/rtti/module.f.mjs`](../fjs/types/rtti/module.f.mjs) —
`boolean`, `number`, `string`, `bigint`, `unknown`, `array`, `record`, `or`,
`option`, `never`, `close`, plus `Const` (a primitive, tuple, or struct used
directly as its own schema). It is a value: it can be named, imported,
exported, passed to a function, and returned from one.

Anything the eDSL cannot yet say is a gap in the eDSL, to be closed there —
not a reason to grow a second notation beside it. This is the rule that keeps
the whole direction from collapsing back into "a superset of JavaScript with a
type grammar", which is the thing this project exists to avoid
([types-for-fs.md](./types-for-fs.md)).

**The eDSL is expected to grow, and growing it is library work.** Today it says
primitives, `array`, `record`, `or`, `option`, `never`, `close`, and consts. It
does not yet say functions
([668](../fjs/types/rtti/todo/668-rtti-function-types.md)) or brands
([134](./134-nominal-types-proposal.md)), and it will need to say more than
that. Because a type is a *value*, each of those is a new exported function in
a module — not a keyword, not a grammar production, not a tokenizer change, and
not an edit to the annotation form, which stays `//: name` forever.

Generics are the example worth stating, because they are usually the point at
which a type language becomes a second language. **A generic type is a function
from schemas to schemas** — and the eDSL ships two already, `array` and
`record`, which are exactly that shape. A third is a `const`:

```js
const pair = t => close([t, t])   // a generic type, in the language, today

const pairOfKeys = pair(key)      // an instantiation is a `const`, like any other
//: pairOfKeys
export const kk = ['a', 1]
```

Nothing in the value layer has to change, nothing in the annotation form has to
change, and no variance annotations, inference rules, or checker support for a
generic type grammar have to be invented — roughly the entire cost TypeScript
pays for the same feature. What is missing is only the rendering side: `.d.ts`
emission and `Ts<>` for a parameterised alias (stage 8).

#### 2. Types are applied with a comment naming one

```js
//: myType
/*: myType */
```

The body is a **name** — a single identifier, bound in the module by a `const`
or an `import`, whose value is an RTTI schema. Nothing else is accepted: no
call, no member access, no operator, no literal. The two forms hold the same
thing and differ only in placement: the line form annotates what follows it,
the block form annotates inside an expression.

Anything more than a name is written as an ordinary `const` first, in the
language, where it already belongs:

```js
import { array, number, option, or, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'

const key = or(number, string)
const keys = array(key)
const maybeKey = option(key)

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
- stage 10 is per-annotation, not per-module and certainly not a flag day: a
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

Two reasons it earns its keep while the tree migrates. Where RTTI cannot yet say
something — function types being the large case ([stage 7](#tasks)) — JSDoc
covers that declaration and RTTI covers the rest of the module, in the same
file, with no either/or and no waiting for the eDSL to catch up. And where both
are present the two checkers **cross-check each other**: a value the schema
accepts and the `@typedef` rejects, or the reverse, is exactly the silent drift
this epic exists to remove ([Problem](#problem)) — reported, instead of latent.
Carrying both is therefore a diagnostic worth having during a conversion, not a
cost to minimize, even though the end state for a `.f.mjs` module is the RTTI
annotation alone.

[type-annotations](../spec/todo/3360-type-annotations.md) reaches the same
conclusion — "`/*: … */` and JSDoc's `/** … */` coexist while the tree
migrates" — and is the spec-side half of this epic. It states the body as an
expression; **this epic narrows it to a name**, and stage 2 is where that
narrowing lands in the spec.

#### 3. Every RTTI type is immutable, and that is what makes it sound

RTTI cannot describe a mutable value, and this is a feature rather than a
missing one. FunctionalScript values are immutable, and the eDSL has no way to
spell a writable member: `Ts<T>` renders every struct member, array, record,
and tuple as `readonly`
([`ts/types.ts`](../fjs/types/rtti/ts/types.ts)), because there is no other
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
`subset` is inclusion between two such sets, decided on the canonical
[`data`](../fjs/types/rtti/data/module.f.mjs) form, with no writer anywhere to
make the answer go stale. Three concrete consequences:

- **A check stays true.** `validate` returns the value it was handed —
  `Object.is(result, input)` — precisely because nothing can change it
  afterwards. Verify-then-mutate, the standard hole in run-time validation
  over mutable data, has no analogue.
- **Compile time and run time agree by construction.** The same schema decides
  both, and there is no mutation in between to make the compile-time answer
  wrong at run time. That agreement is the epic's whole claim, and it is
  immutability that supports it.
- **`subset` is data, not language semantics.** Assignability is a pure
  function of two canonical values, which is why it could ship long before the
  checker that will use it.

Where mutability is planned it stays outside RTTI's reach by design: local
mutable objects with ownership tracking
([mutability](../spec/todo/mutability.md)) become immutable at the point they
escape, and it is the escaped, immutable value that a schema describes.
Tracking ownership is the compiler's job; RTTI never sees a mutable value.

#### 4. Scope: FunctionalScript files only

| Source | Type system | Checked by | How long |
| --- | --- | --- | --- |
| `.f.mjs` | RTTI schemas + `//:` / `/*: */` | the FunctionalScript compiler | the destination |
| `.mjs` | TypeScript types in JSDoc | `tsc` | indefinitely — it is ordinary JavaScript |
| `types.ts` | TypeScript | `tsc` | **for a while** — until TypeScript is no longer used |
| `.d.ts` | TypeScript | generated, not authored | as long as TypeScript consumers exist |

The last column is the part that is easy to get wrong, because the two
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
declaration. 92 of the 94 `types.ts` files in the tree sit next to a
`module.f.mjs`, so this is nearly all of them.

That is not a contradiction of
[migrate-typescript-to-mjs.md](./migrate-typescript-to-mjs.md), which says four
times that authored `types.ts` "may remain permanently" — but it is a narrower
reading of that word, and worth stating plainly. There, permanence is with
respect to *that* migration: a `types.ts` is not an implementation-migration
target and must not be forced through JSDoc translation. It says nothing about
what happens when TypeScript stops being the type system, which is what this
epic is about. Both hold: a `types.ts` survives stage 1 of that migration
untouched, and retires under stage 10 of this one.

The regimes coexist by file extension either way, which is the seam that
document already establishes, and `.f.mjs` modules keep their JSDoc and their
`types.ts` until the RTTI checker can actually replace them.

#### 5. `.d.ts` is generated, for consumers only

An npm package ships `.d.ts` so that TypeScript consumers see types; the
declarations are **generated from the schemas**, never authored.
[`fjs/types/rtti/ts/module.f.mjs`](../fjs/types/rtti/ts/module.f.mjs) is already
that printer — `thunk RTTI → toData → dataToTs`, emitting canonical aliases with
recursion handled — so this is plumbing plus an `fjs` command, and it is the
stage that can land earliest and entirely on its own. It is also what lets a
`.f.mjs` module drop its JSDoc without any consumer noticing.

### What already exists

| Piece | Where | State |
| --- | --- | --- |
| Schema constructors | [`fjs/types/rtti/module.f.mjs`](../fjs/types/rtti/module.f.mjs) | done |
| Run-time checking | [`parse/`](../fjs/types/rtti/parse/module.f.mjs), [`validate/`](../fjs/types/rtti/validate/module.f.mjs) | done — same acceptance, differing only in what a success carries |
| Canonical data form, `subset` | [`data/`](../fjs/types/rtti/data/module.f.mjs) | done — `subset` **is** assignability as a decidable operation, the primitive a checker needs |
| TypeScript emission | [`ts/module.f.mjs`](../fjs/types/rtti/ts/module.f.mjs) | done — the `.d.ts` generator, minus the command |
| Compile-time bridge | `Ts<T>` in [`ts/types.ts`](../fjs/types/rtti/ts/types.ts) | done, and transitional — see Problem |
| Annotation syntax | — | not started |
| Compile-time evaluation | [`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md) | not started |
| Inference | [type inference](../spec/todo/3370-type-inference.md) | not started — most of the work |
| Function schemas | [668-rtti-function-types](../fjs/types/rtti/todo/668-rtti-function-types.md) | not started — 1318 of 3772 JSDoc type bodies are function types |
| Generic schemas | the eDSL itself | **value layer done** — a schema-to-schema function needs no feature; only `.d.ts` / `Ts<>` rendering is missing |

More than half the run-time and emission side is built. The compile-time side is
the part that does not exist.

### Non-goals

- **A type grammar.** Not a subset of TypeScript's type expressions, not a JSDoc
  dialect, not a new one. Commitment 1 is the whole point of the epic.
- **New syntax beyond the two comment forms.** `//:` and `/*: */` are the entire
  surface area added to the language.
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

Ordered. Stage 1 is independent of everything else and can start today; stages
3 onward are gated on the compiler.

- [ ] **1. `.d.ts` generation from schemas.** An `fjs` command over
      [`ts/module.f.mjs`](../fjs/types/rtti/ts/module.f.mjs), wired into
      packaging ([publishing-packages](../fjs/ci/todo/publishing-packages.md)).
      No compiler work, no language change.
- [ ] **2. Settle the annotation form.** Narrow the body from an expression to a
      name in [type-annotations](../spec/todo/3360-type-annotations.md), and
      settle which positions accept an annotation — `const`, parameter, return,
      export — and what the line form attaches to.
- [ ] **3. Recognize `//:` and `/*: */` in the parser** and resolve the one
      identifier in the body against the module's bindings. A distinct token
      kind is cleaner than inspecting the body's first character; neither adds a
      grammar, and neither needs the expression parser.
- [ ] **4. Evaluate an annotation at compile time**
      ([`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md)) — the binding the name
      resolves to must be reducible to a schema value, and the error when it is
      not is a compile error.
- [ ] **5. Check literal right-hand sides** with `validate`. This is the first
      point at which the epic checks anything.
- [ ] **6. Inference, then general right-hand sides.** Infer a schema for an
      arbitrary expression and ask `subset(inferred, declared)`. `subset`
      exists; the inference does not
      ([type inference](../spec/todo/3370-type-inference.md)). Most of the work.
- [ ] **7. Function schemas**
      ([668-rtti-function-types](../fjs/types/rtti/todo/668-rtti-function-types.md)),
      and what an annotation on a function *means* — a compile-time check that
      cannot be completed, or a wrapper validating each call. Until this is
      settled, `//:` can join `@type` but not replace it.
- [ ] **8. Generic schemas.** A generic type is a function from schemas to
      schemas — `array` and `record` already are — so the value layer needs
      nothing. Two things do: `.d.ts` emission for a parameterised alias, and
      the fact that under the name-only rule every *instantiation* must also be
      named (`const keys = array(key)`), which is worth confirming does not
      become noise at 169 `@template` uses.
- [ ] **9. Nominal types.** [`fjs/types/nominal`](../fjs/types/nominal/module.f.mjs)
      has no RTTI representation: either RTTI gains a brand-carrying wrapper, or
      nominal types stay a TypeScript-era construct
      ([134-nominal-types-proposal](./134-nominal-types-proposal.md)).
- [ ] **10. Retire `Ts<T>`, the JSDoc types in `.f.mjs`, and the `types.ts`
      beside them,** declaration by declaration — the two annotation forms are
      disjoint, so this needs no flag day and no module-at-a-time rule — once
      1–8 hold. A `types.ts` goes when its module's schemas cover what it
      declared and nothing outside still imports it; consumers keep seeing types
      through generated `.d.ts`. This is the stage where TypeScript stops being
      the type system for FunctionalScript, and it is per-module, not a cutover.

### Open questions

1. **Qualified names.** Is `ns.myType` a name or a member access? It reads as
   one name to a person and is a property lookup to a parser, and the answer
   decides whether a module using a namespace import
   ([namespace-import](../spec/todo/2220-namespace-import.md)) must add a named
   import just to annotate. Allowing a dotted name is the one relaxation worth
   considering; allowing it to be *general* member access is not.
2. **Which bindings qualify.** A name resolves to a binding that has to reduce
   to a schema value — module-level `const` and `import` only, or anything the
   compiler can reduce? A name is not automatically compile-time known just
   because it is a name.
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
6. **Ownership-tracked locals.** A local mutable object
   ([mutability](../spec/todo/mutability.md)) has no RTTI type while it is still
   mutable. Whether it may be annotated at all — with the schema its escaped
   form will satisfy — or simply cannot be, is undecided, and it is the one
   place the two designs touch.

### Related

The issues this epic subsumes or coordinates. Each stays its own file; this one
does not replace them.

**Core — the epic is these three, in order:**

- [type-annotations](../spec/todo/3360-type-annotations.md) — the annotation
  form, the parser consequences, and the argument for why there is no type
  grammar. The spec-side statement of commitments 1 and 2; stages 2–5 land
  there. It states the annotation body as an ordinary expression handed to the
  expression parser; **this epic narrows it to a name**, and stage 2 is that
  edit.
- [type inference](../spec/todo/3370-type-inference.md) — annotations are only
  as useful as what can be inferred without them. Stage 6.
- [668-rtti-function-types](../fjs/types/rtti/todo/668-rtti-function-types.md) —
  RTTI cannot describe a function today, and FunctionalScript modules are
  almost entirely functions. Stage 7, and the first real test of "growing the
  eDSL is library work".

**Design background:**

- [141](../fjs/types/todo/141.md) — the earlier, more abstract form of this idea:
  a `TypeSystem<T>` interface with `equal`/`subset`, and a parser recognizing
  `Ts<typeof t>`. `subset` shipped in
  [`rtti/data`](../fjs/types/rtti/data/module.f.mjs); the parser half is this
  epic.
- [types-for-fs.md](./types-for-fs.md) — why TypeScript's own type system is not
  the target: it cannot analyze mutable types soundly, which is the argument
  commitment 3 turns around. It also already sketches `const x = //: RTTI-TYPE`
  under "Benefits" — the annotation form of this epic, proposed there first.
- [new-pl.md § Type System](./new-pl.md#type-system) — the same idea one level
  out: type checking as an opt-in library rather than a language feature.
- [edag-spec.md](./edag-spec.md) — already specifies the EDAG with RTTI and
  generates Rust from it; the same schemas would feed both.
- [134-nominal-types-proposal](./134-nominal-types-proposal.md) — stage 9.

**Depends on:**

- [`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md) — the compiler loading and
  running modules as meta-programming, which is what compile-time evaluation of
  an annotation *is*. Nothing past stage 2 starts without it.
- [migrate-typescript-to-mjs.md](./migrate-typescript-to-mjs.md) — establishes
  the `.f.mjs` / `.mjs` / `types.ts` / `.d.ts` split that commitment 4 assigns
  type systems to. Its "`types.ts` may remain permanently" is permanence with
  respect to *that* migration; stage 10 here is what eventually retires them.
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
  it tracks. Open question 6 is where the two meet.

**Affected, but standing on their own:**

- [strict-static-analysis.md](./strict-static-analysis.md) and
  [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) — the near-term work,
  unaffected. `tsc` remains the checker throughout.
- [eslint.md](./eslint.md) — `no-inline-type-cast` and `no-unknown-jsdoc-tag`
  are **transitional**, and must not be used to justify building a
  TypeScript-type grammar.
- [inline-type-casts.md](./inline-type-casts.md) — stands unchanged; most of its
  sites are noise under any type system.
- [publishing-packages](../fjs/ci/todo/publishing-packages.md) — consumes stage
  1's generated `.d.ts`.
- [`fjs/types/rtti/ts/README.md`](../fjs/types/rtti/ts/README.md) — not an issue,
  but the record of what `Ts<T>` costs and why stage 10 exists.
- [rtti-parse](../fjs/media/json/todo/rtti-parse.md) — reading JSON text
  straight against a schema; the run-time side continuing to grow around the
  same source of truth.
- [expression](../spec/todo/3410-expression.md) — **not** a dependency, which is
  the point of the name-only rule: an annotation body needs no expression
  parser. It stays a dependency of the *language*, not of this epic.
