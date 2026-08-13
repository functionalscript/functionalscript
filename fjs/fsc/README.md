# FunctionalScript Compiler

## Source files and repository migration

The FunctionalScript repository uses extensions to separate runtime source,
type-only source, source-language migration, and compatibility with the current
FunctionalScript compiler.

| Extension | Meaning |
|---|---|
| `.f.ts` | Authored FunctionalScript-intent TypeScript implementation/proof source. **No longer used**: stage 1 removed the last one, and new source must not use this extension. It appears below only to describe that completed migration. |
| `.f.mjs` | Authored FunctionalScript-intent ESM JavaScript with JSDoc types. It may use FunctionalScript features the current parser/compiler does not support yet. |
| `.f.js` | During stage 1, generated JavaScript emitted from `.f.ts` and never authored. After stage 1 and authored-`.f.js` package support are complete, authored FunctionalScript that the current parser/compiler must accept. |
| `types.ts` | Authored TypeScript source for a type-level API. It may coexist with `.f.mjs` or later `.f.js` and holds no runtime implementation. |
| `.d.ts`, `.d.mts` | Generated TypeScript declarations. |

The migration is deliberately split into two implementation stages. The
repository-wide plan is
[`todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md),
and the package conventions are documented in
[`fjs/ci/todo/publishing-packages.md`](../ci/todo/publishing-packages.md).

### Stage 1: remove authored TypeScript implementations

**Stage 1 source conversion is complete** — no authored implementation or proof
`.f.ts` remains, so every rename described in this section has already happened.
It is kept as the record of what the extensions mean and why; write new source as
`.f.mjs` plus, where a type-level API is separately useful, `types.ts`.

Before the first real repository implementation conversion, complete both
prerequisites in order:

1. [authored `.mjs` package support](../ci/todo/f-mjs-package-support.md),
   including `allowJs` / `checkJs`, authored `types.ts`, split
   declaration/runtime emission, Deno validation, package inclusion, and
   clean-consumer tests;
2. [`.f.mjs` test and coverage fixtures](../emergent_testing/todo/f-mjs-test-and-coverage.md),
   which are **blocked by** package support and prove with an actual `.f.mjs`
   runtime fixture that proofs execute and Node/Deno coverage retains the
   migrated module.

Package and publish jobs run from a clean CI checkout, so the package prerequisite
does not require developer-worktree cleanup or tracking ignored outputs from
earlier revisions.

Then migrate runtime dependency leaves first:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
proof.f.ts  -> proof.f.mjs
```

Type-only source may stay in TypeScript:

```text
module.f.ts -> types.ts
```

A runtime module may also split its type-level API before the implementation
migration and keep that source path unchanged throughout:

```text
types.ts + module.f.ts
types.ts + module.f.mjs
types.ts + module.f.js
```

This stage is independent of FunctionalScript parser coverage. `.f.mjs` means
FunctionalScript-intent JavaScript; it is not a compiler-compatibility promise.
A `.f.ts` implementation should move once its authored runtime dependencies can
move, even if the current compiler cannot parse every feature it uses.

The transition is asymmetric for runtime dependencies: remaining `.f.ts` may
depend on already migrated `.f.mjs`, while migrated `.f.mjs` must not runtime
import remaining implementation `.f.ts`. Cycles may migrate as a coherent group.
Type-only APIs may remain in authored `types.ts` and do not participate in
runtime migration ordering.

Both TypeScript and JavaScript source reference the same real `types.ts` file.
TypeScript source uses `import type`:

```ts
import type { Phantom } from './types.ts'
```

JavaScript source uses JSDoc `@import`:

```js
/** @import { Phantom } from './types.ts' */
```

Both forms are type-only. Unlike the rejected authored-`.d.ts` convention, this
does not depend on TypeScript resolving a nonexistent `.ts` or `.js` specifier
to a declaration file: `types.ts` exists as authored source, so Deno can resolve
the same path directly.

Migrated JavaScript must not retain a type-only source edge to a remaining
**implementation** `.ts` / `.f.ts`. If that type should survive independently of
the implementation, split it into `types.ts` first; if it is naturally local to
the implementation and expressible in JSDoc, migrate it with the implementation.

A declaration-only file should normally become `types.ts` rather than `.f.mjs`.
`fjs/types/phantom/module.f.ts`, whose `Phantom` type uses a type-only
`declare const phantomKey: unique symbol`, is the canonical example: it can
become `fjs/types/phantom/types.ts` without inventing a runtime `Symbol()` value.

`types.ts` is ordinary TypeScript source, so the normal TypeScript check validates
it even while `skipLibCheck` remains enabled for `.d.ts` dependencies. No
`.gitignore` exception or declaration-file checking policy is needed for authored
type source.

The package behavior of permanent `types.ts` must be validated before the first
real migration. In particular, with `rewriteRelativeImportExtensions: true`, the
package fixture must verify how references to `./types.ts` from both `.ts` and
`.mjs` appear in emitted declarations, which generated `types.js` / `types.d.ts`
files are required, and that TypeScript, Node, Deno, and Bun can consume the
packed result. Do not simplify the TypeScript runtime-emission pass until that
experiment establishes whether generated `types.js` remains necessary.

Proofs followed the same runtime source-language rule and completed the same
move, so a `module.f.mjs` is accompanied by a `proof.f.mjs`. Type-only APIs may
remain in `types.ts`. Current FunctionalScript compiler support was never a
condition for that rename.

#### Private JSDoc typedefs

TypeScript declaration emit currently turns JSDoc `@typedef`s into exported type
aliases, including typedefs that exist only as implementation details. This is
tracked upstream by
[microsoft/TypeScript#46407](https://github.com/microsoft/TypeScript/issues/46407).

Until JSDoc typedefs can be stripped with `@internal` and `stripInternal`, use a
leading `_` for implementation-only typedefs created during the migration:

```js
/** @typedef {number} _Type */
```

The underscore is an API contract, not declaration-level visibility. Generated
`.d.ts` / `.d.mts` may still contain `export type _Type = number`, but names that
begin with `_` are private FunctionalScript implementation details. Consumers
must not rely on those names directly, so renaming or removing a `_`-prefixed
alias is not a breaking change solely because TypeScript emitted it. The public
contract still governs transitive effects: if a public type depends on `_Type`,
changing `_Type` in a way that changes that public type's assignability is a
breaking change and requires the normal `**BREAKING CHANGES:**` treatment.

For example, suppose the generated declaration initially contains:

```ts
export type _Internal = number
export type Public = readonly [_Internal]
```

Changing it to this is **not** a breaking change:

```ts
export type Public = readonly [number]
```

`_Internal` disappeared, but the expanded public contract of `Public` is still
`readonly [number]`. A consumer that imported `_Internal` directly was depending
on a private implementation detail.

By contrast, changing it to this **is** a breaking change:

```ts
export type _Internal = string
export type Public = readonly [_Internal]
```

The emitted private alias is still private, but the expanded public contract of
`Public` changed from `readonly [number]` to `readonly [string]`.

Public JSDoc typedefs keep ordinary names without the `_` prefix. Which JSDoc
typedefs are public is an API design decision, not a mechanical restatement of
what the pre-migration `.f.ts` file happened to export: a helper that belongs to
the module's public vocabulary may be published under an ordinary name even
though its TypeScript alias was module-private, and a former export may become
`_` when it only ever described an implementation detail. Types intentionally
separated into `types.ts` use ordinary TypeScript source visibility instead of
this JSDoc-emission workaround.

When upstream support is ready, replace this workaround with `@internal`; that
cleanup is tracked by
[`todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md).

When the last authored implementation/proof `.ts` / `.f.ts` file is gone,
authored `types.ts` files may remain. Remove obsolete generated runtime outputs
only as allowed by the package-support fixture; do not assume the TypeScript
runtime-emission pass can disappear while package resolution may still require a
generated `types.js`. Remove the blanket `**/*.js` rule from `.gitignore` only
when generated implementation `.js` no longer conflicts with authored `.js`.

### Stage 2: mark compiler-compatible FunctionalScript

The repository compiler-compatibility migration in
[`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md) is
**blocked by** stage 1. Before its first rename, also complete
[authored `.f.js` package support](../ci/todo/f-js-package-support.md), so a
standalone `.f.js` is directly type-checked, receives a `.d.ts`, is packed in
the clean CI package build, and resolves for a clean consumer.

Then migrate compiler-supported dependency-closed groups incrementally:

```text
module.f.mjs -> module.f.js
```

An authored `.f.js` is a compatibility commitment: the FunctionalScript parser
and compiler in the same repository revision must accept the complete module,
and its runtime and declaration dependencies must satisfy the compiler migration
rules. Unsupported modules remain `.f.mjs` until the required compiler features
land. A sibling authored `types.ts` remains unchanged across this rename.

A synthetic JavaScript compiler fixture may be used before repository migration;
it does not change the extension contract for repository source.

## Tokenizer

- `!` - logicalNot
  - `!=` - nonStrictNotEqual
  - `!==` - notEqual
- `"` - doubleStringBegin
- `$` - idBegin
- `%` - remainder
  - `%=` - remainder assignment
- `&` - bitwiseAnd
  - `&&` - logicalAnd
  - `&&=` - logicalAndAssignment
  - `&=` - bitwiseAndAssignment
- `'` - singleStringBegin
- `(` - groupingBegin
- `)` - groupingEnd
- `*` - multiplication
  - `**` - exponential
  - `**=` - exponentialAssignment
  - `*/` - commentEnd
  - `*=` - multiplicationAssignment
- `+` - addition
  - `++` - increment
  - `+=` - additionAssignment
- `,` - comma
- `-` - subtraction
  - `--` - decrement
  - `-=` - subtractionAssignment
- `.` - dot
  - `...` - spread
- `/` - division
  - `/*` - commentBegin
  - `//` - oneLineComment
  - `/=` - divisionAssignment
- `0..9` - numberBegin
- `:` - colon
- `;` - semicolon
- `<` - less
  - `<<` - leftShift
  - `<<=` - leftShiftAssignment
  - `<=` - lessEqual
- `=` - assignment
  - `==` - nonStrictEqual ?
  - `===` - equal
  - `=>` - arrow
- `>` - greater
  - `>=` - greaterEqual
  - `>>` - rightShift
  - `>>>` - unsignedRightShift
  - `>>>=` unsignedRightShiftAssignment
- `?` - question
  - `?.` - optional chaining
  - `??` - nullish coalescing
- `A..Z` - idBegin
  - `Infinity` - infinity
  - `NaN` - nan
- `[` - propertyBegin
- `]` - propertyEnd`
- `^` - bitwiseXor
  - `^=` - bitwiseXorAssignment
- `_` - idBegin
- '`' - templateBegin
- `a..z` - idBegin
  - `async` ?
  - `await` ?
  - `break`
  - `case`
  - `catch`
  - `class`
  - `const`
  - `continue`
  - `debugger`
  - `delete` ?
  - `do` ?
  - `else`
  - `export`
  - `false`
  - `function` ?
  - `globalThis` ?
  - `for`
  - `if`
  - `import`
  - `in`
  - `instanceof`
  - `let`
  - `new` ?
  - `null`
  - `of`
  - `return`
  - `super`
  - `switch`
  - `this` ?
  - `throw`
  - `true`
  - `try`
  - `typeof`
  - `undefined`
  - `var`
  - `void`
  - `while`
  - `yield`
- `{` - objectBegin
- `|` - bitwiseOr
  - `|=` - bitwiseOrAssignment
  - `||` - logicalOr
  - `||=` - logicalOrAssignment
- `}` - objectEnd
- `~` - bitwiseNot
  - `~=` - bitwiseNotAssignment
