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

Four commitments make that concrete.

#### 1. Types are values, written in the RTTI eDSL

There is **no type language to invent**. A type is an ordinary expression built
from [`fjs/types/rtti/module.f.mjs`](../fjs/types/rtti/module.f.mjs) —
`boolean`, `number`, `string`, `bigint`, `unknown`, `array`, `record`, `or`,
`option`, `never`, `close`, plus `Const` (a primitive, tuple, or struct used
directly as its own schema). It is a value: it can be named, imported,
exported, passed to a function, and returned from one.

Anything the eDSL cannot yet say is a gap in the eDSL, to be closed there —
not a reason to grow a second notation beside it. This is the rule that keeps
the whole direction from collapsing back into "a superset of JavaScript with a
type grammar", which is the thing this project exists to avoid
([types-for-fs.md](./types-for-fs.md)).

#### 2. Types are applied with a comment, in one of two forms

```js
//: rttiTypeName
/*: rttiTypeName */
```

Both hold the *same thing*: an ordinary expression, resolved in the module's own
scope, that evaluates to an RTTI schema. The two differ only in placement — the
line form annotates what follows it, the block form annotates in the middle of
an expression:

```js
import { array, number, or, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'

export const key = or(number, string)

//: key
export const a = 'hello'

export const first = (xs /*: array(key) */) /*: option(key) */ => xs[0]
```

Recognizing these is nearly free. The tokenizer keeps a comment's body verbatim,
so the forms are separated by the body's first character — `:` is an
annotation, `*` is JSDoc, anything else is a comment — and the body then goes to
the **expression parser that already exists**. No block grammar, no type
grammar, no second parser. See
[type-annotations](../spec/todo/3360-type-annotations.md), which works this out
in detail and is the spec-side half of this epic.

#### 3. Scope: FunctionalScript files only

| Source | Type system | Checked by |
| --- | --- | --- |
| `.f.mjs` | RTTI schemas + `//:` / `/*: */` | the FunctionalScript compiler |
| `.mjs` | TypeScript types in JSDoc | `tsc` |
| `types.ts` | TypeScript | `tsc` |
| `.d.ts` | TypeScript | generated, not authored |

`.mjs` is ordinary JavaScript and stays in the TypeScript world indefinitely;
this is not a migration that ends with JSDoc deleted from the tree. The two
regimes coexist by file extension, which is the same seam
[migrate-typescript-to-mjs.md](./migrate-typescript-to-mjs.md) already
establishes, and `.f.mjs` modules keep their JSDoc until the RTTI checker can
actually replace it.

#### 4. `.d.ts` is generated, for consumers only

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

More than half the run-time and emission side is built. The compile-time side is
the part that does not exist.

### Non-goals

- **A type grammar.** Not a subset of TypeScript's type expressions, not a JSDoc
  dialect, not a new one. Commitment 1 is the whole point of the epic.
- **New syntax beyond the two comment forms.** `//:` and `/*: */` are the entire
  surface area added to the language.
- **Typing `.mjs` with RTTI.** Ordinary JavaScript keeps TypeScript and JSDoc.
- **Replacing `tsc` soon.** `tsc` and the standard toolchain are the checker
  until every stage below has landed, and turning them up as far as they go is
  the near-term work ([strict-static-analysis.md](./strict-static-analysis.md),
  [tsconfig-strict-flags.md](./tsconfig-strict-flags.md)).
- **Hand-written `.d.ts`.** Generated or absent.

### Tasks

Ordered. Stage 1 is independent of everything else and can start today; stages
3 onward are gated on the compiler.

- [ ] **1. `.d.ts` generation from schemas.** An `fjs` command over
      [`ts/module.f.mjs`](../fjs/types/rtti/ts/module.f.mjs), wired into
      packaging ([publishing-packages](../fjs/ci/todo/publishing-packages.md)).
      No compiler work, no language change.
- [ ] **2. Settle the annotation form.** Which positions accept an annotation —
      `const`, parameter, return, export — and what the line form attaches to.
      Write it into [type-annotations](../spec/todo/3360-type-annotations.md).
- [ ] **3. Recognize `//:` and `/*: */` in the parser** and hand the body to the
      existing expression parser
      ([expression](../spec/todo/3410-expression.md)). A distinct token kind is
      cleaner than inspecting the first character; neither adds a grammar.
- [ ] **4. Evaluate an annotation at compile time**
      ([`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md)) — including which
      expressions may be referenced, and the error when one is not
      compile-time known.
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
      nothing. `.d.ts` emission for a parameterised alias does.
      169 `@template` uses today.
- [ ] **9. Nominal types.** [`fjs/types/nominal`](../fjs/types/nominal/module.f.mjs)
      has no RTTI representation: either RTTI gains a brand-carrying wrapper, or
      nominal types stay a TypeScript-era construct
      ([134-nominal-types-proposal](./134-nominal-types-proposal.md)).
- [ ] **10. Retire `Ts<T>` and the JSDoc types in `.f.mjs`,** module by module,
      once 1–8 hold. Consumers keep seeing types through generated `.d.ts`.

### Open questions

1. **Staging.** Which expressions may an annotation reference — module-level
   constants only, or anything the compiler can reduce?
2. **Schemas that are themselves checked.** An annotation's expression is a
   value in the same module system; whether a schema is checked against
   `Type`'s own schema, and what that costs, is unanswered.
3. **Error reporting.** A failed check is a `{ path, message }` from a run-time
   reader. What that looks like as a compile-time diagnostic — with a source
   span — is undesigned.
4. **Cost.** Every annotation is a module evaluation. Whether the compiler
   memoizes schemas across a build, and on what key, is open.

### Related

The issues this epic subsumes or coordinates. Each stays its own file; this one
does not replace them.

**Core — the epic is these three, in order:**

- [type-annotations](../spec/todo/3360-type-annotations.md) — the annotation
  form, the parser consequences, and the argument for why there is no type
  grammar. The spec-side statement of commitments 1 and 2; stages 2–5 land
  there.
- [type inference](../spec/todo/3370-type-inference.md) — annotations are only
  as useful as what can be inferred without them. Stage 6.
- [668-rtti-function-types](../fjs/types/rtti/todo/668-rtti-function-types.md) —
  RTTI cannot describe a function today, and FunctionalScript modules are
  almost entirely functions. Stage 7.

**Design background:**

- [141](../fjs/types/todo/141.md) — the earlier, more abstract form of this idea:
  a `TypeSystem<T>` interface with `equal`/`subset`, and a parser recognizing
  `Ts<typeof t>`. `subset` shipped in
  [`rtti/data`](../fjs/types/rtti/data/module.f.mjs); the parser half is this
  epic.
- [types-for-fs.md](./types-for-fs.md) — why TypeScript's own type system is not
  the target: it cannot analyze mutable types soundly.
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
  the `.f.mjs` / `.mjs` / `types.ts` / `.d.ts` split that commitment 3 assigns
  type systems to.
- [fjs-nanvm-integration.md](./fjs-nanvm-integration.md) — the path to a
  compiler that parses authored FunctionalScript.
- [`fjs/bnf/todo/layered-parser.md`](../fjs/bnf/todo/layered-parser.md) — the
  transducer stack the tokenizer work in stage 3 belongs to.
- [js-string-literals](../spec/todo/2460-js-string-literals.md) — the
  repository's own `.f.mjs` sources are not yet input the parser accepts.

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
