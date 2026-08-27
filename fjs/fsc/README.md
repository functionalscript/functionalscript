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
packed result. That experiment ran in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): only
`types.d.ts` is required, generated `types.js` is not, and the runtime-emission
pass is gone — `prepack` emits declarations and then re-checks the tree with
them present, so declaration-emit degradation still fails packaging.

Proofs followed the same runtime source-language rule and completed the same
move, so a `module.f.mjs` is accompanied by a `proof.f.mjs`. Type-only APIs may
remain in `types.ts`. Current FunctionalScript compiler support was never a
condition for that rename.

#### Private types

A private type is one consumers must not depend on, and its name begins with
`_`. Where it is written follows from who reaches it:

- a type some shipped public declaration names — including the declaration of an
  exported runtime function — is part of the **public declaration closure** and
  belongs in `types.ts`, or is inlined. It ships, `_` and all; moving it
  somewhere unshipped would only leave the public declaration incomplete.
- a type nothing public reaches belongs in an optional sibling `private.ts`. It
  is checked with the rest of the program, but the `private.d.ts` that
  declaration emit produces for it is deleted by the final `prepack` step and
  never packed.
- a type that exists only to state a compile-time proof lives inside the
  function that proves it.

No authored `.mjs` carries a file-scope `@typedef` at all, because declaration
emit turns one into an exported type alias — the leak this section used to
describe as unavoidable. A typedef inside a function is unaffected. The full
rule, the dependency order between `types.ts`, `private.ts` and the
implementation, and the optional metaprogramming submodule are in
[`fjs/AGENTS.md`](../AGENTS.md#private-types).

The underscore is an API contract, not declaration-level visibility: a shipped
`types.d.ts` may well contain `export type _Type = number`, and a `.d.mts` may
keep a source `/** @import { _T } from './private.ts' */` comment naming a module
that was never packed — a comment in a declaration file is not a dependency.
Consumers must not rely on a `_` name, so renaming or removing one is not a
breaking change solely because TypeScript emitted it. The public contract still
governs transitive effects: if a public type depends on `_Type`, changing
`_Type` in a way that changes that public type's assignability is a breaking
change and requires the normal `**BREAKING CHANGES:**` treatment.

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

Public types keep ordinary names without the `_` prefix. Which of them are public
is an API design decision, not a mechanical restatement of what the
pre-migration `.f.ts` file happened to export: a helper that belongs to the
module's public vocabulary may be published under an ordinary name even though
its TypeScript alias was module-private, and a former export may become `_` when
it only ever described an implementation detail.

Splitting the private types out is what makes the boundary real, so nothing here
waits on `@internal` / `stripInternal` any more. The migration of the files
written before this rule is
[`fjs/todo/separate-private-types.md`](../todo/separate-private-types.md).

When the last authored implementation/proof `.ts` / `.f.ts` file is gone,
authored `types.ts` files may remain. The TypeScript runtime-emission pass is
removed ([#1520](https://github.com/functionalscript/functionalscript/pull/1520)
measured that package resolution does not require a generated `types.js`), while
`prepack` keeps a no-emit re-check with declarations present and then drops the
generated `private.d.ts` files. Remove the blanket
`**/*.js` rule from `.gitignore` only when generated implementation `.js` no
longer conflicts with authored `.js`.

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
