# `/*: type */` annotations checked by RTTI

**Priority:** P5
**Status:** open — direction only, gated on the compiler

### Scope

This is a **direction, not a plan**. Nothing here is implemented, and work on it
starts only once there is a proper FunctionalScript compiler: the annotation has
to be recognized by the compiler's own parser, and checking it means the compiler
can load and evaluate a module at compile time
([`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md)).

Until then TypeScript is the type checker, and the near-term work is to turn the
standard toolchain up as far as it goes — see
[strict-static-analysis.md](./strict-static-analysis.md). Nothing in this issue
argues against any of that.

### Direction

FunctionalScript does not want a type *language*. TypeScript's answer — a
superset of JavaScript with its own type grammar — is the thing to avoid, and
JSDoc's answer is the same grammar again, only noisier. The direction instead:

- A type is an ordinary **value**, built from
  [`fjs/types/rtti`](../fjs/types/rtti/README.md).
- An annotation is a comment holding an ordinary **expression** that evaluates
  to one of those values.
- The compiler loads that expression at compile time and checks the annotated
  value against it.

```js
import { number, or, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'

export const myType = or(number, string)

export const a /*: myType */ = 'hello'
```

`.d.ts` can be generated from the same schemas, and inference should carry as
much of the burden as possible so annotations stay rare. `/*: … */` and
`/** … */` coexist while the tree migrates.

### What this settles about the parser

An earlier revision of this issue proposed a two-layer JSDoc parser: a block
grammar, and underneath it a grammar for a subset of TypeScript's type
expressions. **That second layer is the wrong thing to build** — it is the
superset this project exists to avoid, re-implemented in the repository's own
BNF.

Under `/*: expr */` there is no type grammar at all. The annotation body is an
expression in the module's own scope, which the FunctionalScript parser already
handles. What is needed is only a way to recognize the annotation and hand its
body to the existing expression parser.

That recognition is nearly free today. The tokenizer keeps a block comment's
body verbatim, so the three forms differ in their first character:

```js
// export const a /*: myType */ = "hello"
{ kind: '/*', value: ': myType ' }     // annotation
{ kind: '/*', value: '* @type {X} ' }  // JSDoc
{ kind: '/*', value: ' plain ' }       // comment
```

which is exactly why the two annotation forms can coexist during the
transition. A distinct token kind would be cleaner than inspecting the first
character, but no new grammar is involved either way.

### What already exists

More than half of this is built:

| Piece | Where | State |
| --- | --- | --- |
| Schema constructors | `fjs/types/rtti/module.f.mjs` | `boolean`, `number`, `string`, `bigint`, `unknown`, `array`, `record`, `or`, `option`, `never`, plus `Const` (primitive / tuple / struct used directly as its own schema) |
| Value checking | `fjs/types/rtti/validate/`, `parse/` | `validate(schema)(value)`, `parse(schema)(value)` |
| Canonical data form | `fjs/types/rtti/data/` | `toData`, `cmp`, `equal`, **`subset`**, data-driven `validate` |
| TypeScript emission | `fjs/types/rtti/ts/module.f.mjs` | runtime printer: `thunk RTTI → toData → dataToTs`, emitting canonical type aliases, recursion included |
| Compile-time bridge | `Ts<T>` in `fjs/types/rtti/ts/types.ts` | maps a schema to its TypeScript type, so `npx tsc` keeps working through the transition |

Two of these matter more than they look. `data`'s **`subset`** is assignability
as a decidable operation on the canonical form — the primitive a checker needs.
And `ts/module.f.mjs` is already the `.d.ts` generator: schemas in, canonical
TypeScript aliases out.

### Open questions

1. **Compile-time evaluation and staging.** Checking `a /*: myType */` requires
   evaluating `myType`, which requires evaluating its imports. Which expressions
   may an annotation reference — module-level constants only, or anything the
   compiler can reduce? What happens when an annotation depends on a value that
   is not compile-time known?

2. **Non-literal right-hand sides.** `validate(myType)('hello')` settles the
   literal case. For `const a /*: t */ = f(x)` the checker must infer an RTTI
   for `f(x)` and ask `subset(inferred, declared)`. `subset` exists; the
   inference does not. This is where "more type inference" has to land, and it
   is most of the work.

3. **Function types.** `Type` is `Const | (() => ['const'|'bigint'|'boolean'|'number'|'string'|'unknown'|'array'|'record'|'or', …])` — there is no function schema. FunctionalScript modules are
   almost entirely functions: 1318 of the 3772 JSDoc type bodies in the tree are
   function types. Either RTTI gains a function schema (parameters plus result,
   with the runtime check necessarily deferred to call sites), or functions are
   only ever inferred and never annotated. This is the largest open question and
   it gates whether `/*: */` can replace `@type` rather than merely join it.

4. **Generic schemas.** 169 `@template` uses today. A generic type is naturally a
   *function from schemas to schemas* — `array` and `record` already are — so
   the value layer needs nothing new. What needs design is `Ts<>` and `.d.ts`
   emission for a parameterised alias.

5. **Nominal types.** `fjs/types/nominal` has no RTTI representation. Branding is
   a compile-time-only fiction, so either RTTI gains a nominal wrapper carrying a
   brand, or nominal types stay a TypeScript-era construct.

### Sketch of an order, when the time comes

1. Recognize `/*: … */` in the compiler's parser and hand its body to the
   existing expression parser.
2. Evaluate the annotation expression at compile time
   ([`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md)).
3. Generate `.d.ts` from the schemas — `fjs/types/rtti/ts` is already the
   printer, so this is plumbing plus a `fjs` command, and it is the step that
   could land earliest and independently.
4. Check literal right-hand sides with `validate`.
5. Design inference, then check general right-hand sides with `subset`.
6. Resolve the function-schema question before `/*: */` goes beyond constants.

### Depends on

- [`fjs/fsc/todo/47.md`](../fjs/fsc/todo/47.md) — the compiler loading and
  running modules as meta-programming, which is what compile-time evaluation of
  an annotation expression means.
- [fjs-nanvm-integration.md](./fjs-nanvm-integration.md) and
  [migrate-typescript-to-mjs.md](./migrate-typescript-to-mjs.md) — the path to a
  compiler that parses authored FunctionalScript.
- [`spec/todo/2460-js-string-literals.md`](../spec/todo/2460-js-string-literals.md) — FunctionalScript's string
  grammar is JSON's, so the repository's own single-quoted `.mjs` sources are
  not yet input the parser accepts. Normalizing them is part of
  [migrate-typescript-to-mjs.md](./migrate-typescript-to-mjs.md) stage 3, not a
  tokenizer defect.

### Consequences for the TypeScript-era work

- [inline-type-casts.md](./inline-type-casts.md) stands unchanged. It describes
  the code as it is today, and 208 of its 357 sites are noise under any type
  system.
- [eslint.md](./eslint.md)'s `no-inline-type-cast` and `no-unknown-jsdoc-tag`
  are **transitional**: worth having while JSDoc is the annotation form, but
  they must not be used to justify building a TypeScript-type grammar. Both are
  satisfiable by matching on the comment's first character plus the JS token
  stream, with no type parsing.
- [tsconfig-strict-flags.md](./tsconfig-strict-flags.md) and
  [strict-static-analysis.md](./strict-static-analysis.md) are unaffected, and
  are the near-term work. `npx tsc` and the standard toolchain remain the
  checker until all of the above exists.

### Related

- [`fjs/types/rtti/README.md`](../fjs/types/rtti/README.md) — the schema system
  this builds on.
- [new-pl.md § Type System](./new-pl.md#type-system) — the same idea one level
  further out: type checking as an opt-in library rather than a language
  feature. This issue is the FunctionalScript-scoped version.
- [ast-spec.md](./ast-spec.md) — already specifies the AST with RTTI and
  generates Rust from it; the same schemas would feed both.
- [types-for-fs.md](./types-for-fs.md) — why TypeScript's own type system is not
  the target.
- [`fjs/bnf/todo/layered-parser.md`](../fjs/bnf/todo/layered-parser.md) — the
  transducer stack the tokenizer work belongs to.
