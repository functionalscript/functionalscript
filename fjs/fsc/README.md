# FunctionalScript Compiler

## Source files and repository migration

The FunctionalScript repository uses extensions to separate runtime source,
type-only declaration source, source-language migration, and compatibility with
the current FunctionalScript compiler.

| Extension | Meaning |
|---|---|
| `.f.ts` | Authored FunctionalScript-intent TypeScript implementation/proof source that has not yet completed the repository TypeScript-to-JavaScript migration. |
| `.f.mjs` | Authored FunctionalScript-intent ESM JavaScript with JSDoc types. It may use FunctionalScript features the current parser/compiler does not support yet. |
| `.f.js` | During stage 1, generated JavaScript emitted from `.f.ts` and never authored. After stage 1 and authored-`.f.js` package support are complete, authored FunctionalScript that the current parser/compiler must accept. |
| `types.d.ts` | Authored, type-checked type-only declaration source. It may coexist with `.f.ts`, `.f.mjs`, or `.f.js` and is not migrated to JavaScript. |
| other `.d.ts`, `.d.mts` | Generated TypeScript declarations. |

The migration is deliberately split into two implementation stages. The
repository-wide plan is
[`todo/migrate-typescript-to-mjs.md`](../../todo/migrate-typescript-to-mjs.md),
and the package conventions are documented in
[`fjs/ci/todo/publishing-packages.md`](../ci/todo/publishing-packages.md).

### Stage 1: remove authored TypeScript implementations

Before the first real repository implementation conversion, complete both
prerequisites in order:

1. [authored `.mjs` package support](../ci/todo/f-mjs-package-support.md),
   including `allowJs` / `checkJs`, `skipLibCheck: false`, authored `types.d.ts`,
   split declaration/runtime emission, package inclusion, and clean-consumer
   tests;
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

Declaration-only source does not need a JavaScript implementation:

```text
module.f.ts -> types.d.ts
```

A runtime module may also split its type-level API before the implementation
migration and keep the declaration companion unchanged throughout:

```text
types.d.ts + module.f.ts
types.d.ts + module.f.mjs
types.d.ts + module.f.js
```

This stage is independent of FunctionalScript parser coverage. `.f.mjs` means
FunctionalScript-intent JavaScript; it is not a compiler-compatibility promise.
A `.f.ts` implementation should move once its authored runtime dependencies can
move, even if the current compiler cannot parse every feature it uses.

The transition is asymmetric for runtime dependencies: remaining `.f.ts` may
depend on already migrated `.f.mjs`, while migrated `.f.mjs` must not runtime
import remaining implementation `.f.ts`. Cycles may migrate as a coherent group.
Type-only APIs may remain permanently in authored `types.d.ts` companions and do
not participate in runtime migration ordering.

Authored source references an authored declaration companion by its real source
path. TypeScript source uses `import type`:

```ts
import type { Phantom } from './types.d.ts'
```

JavaScript source uses JSDoc `@import`:

```js
/** @import { Phantom } from './types.d.ts' */
```

Both forms are type-only and introduce no runtime import. The same authored
`types.d.ts` file is shipped with the package, so the source specifier remains
valid without generating or inventing a runtime `types.js` module.

Migrated JavaScript must not retain a type-only source edge to a remaining
implementation `.ts` / `.f.ts`. If that type should survive independently of the
implementation, split it into `types.d.ts` first; if it is naturally local to
the implementation and expressible in JSDoc, migrate it with the implementation.
Do not invent runtime imports, exports, `Symbol()` values, or other JavaScript
representations solely for TypeScript-only declarations such as `declare const`.

A declaration-only file should normally become `types.d.ts` rather than
`.f.mjs`. `fjs/types/phantom/module.f.ts`, whose `Phantom` type uses a type-only
`declare const phantomKey: unique symbol`, is the canonical example: it can
become `fjs/types/phantom/types.d.ts` without creating a runtime phantom module.
An existing `.f.mjs` that is truly declaration-only may be normalized to
`types.d.ts` for the same reason.

Authored declaration files must be checked, not merely parsed. The root
TypeScript configuration therefore uses `skipLibCheck: false`; this makes
`types.d.ts` participate in normal declaration-file semantic checking, including
name resolution and generic constraints.

Proofs follow the same runtime source-language rule. `proof.f.ts` may remain
temporarily beside a migrated `module.f.mjs`, but it may move to `proof.f.mjs` as
soon as the proof itself is valid JavaScript with JSDoc and its authored runtime
dependencies are already `.f.mjs`. Type-only APIs may remain in `types.d.ts`.
Current FunctionalScript compiler support is not a condition for that rename.

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
separated into `types.d.ts` use ordinary TypeScript declaration-file visibility
instead of this JSDoc-emission workaround.

When upstream support is ready, replace this workaround with `@internal`; that
cleanup is tracked by
[`todo/blocked/jsdoc-typedef-strip-internal.md`](../../todo/blocked/jsdoc-typedef-strip-internal.md).

When the last authored implementation/proof `.ts` / `.f.ts` file is gone,
authored `types.d.ts` files may remain. Remove the TypeScript-to-JavaScript emit
path, remove obsolete generated `.js` from the working tree for that transition,
and remove the blanket `**/*.js` rule from `.gitignore`. Keep generated
declaration ignores with an explicit exception for authored `types.d.ts`. Only
then is `.js` available as an authored extension.

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
land. A sibling authored `types.d.ts` remains unchanged across this rename.

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