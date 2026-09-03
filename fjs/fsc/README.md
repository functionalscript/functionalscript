# FunctionalScript Compiler

## There is no grammar here yet

This package once held `bnf.f.mjs` and `json.f.mjs`, a FunctionalScript module
grammar over a complete JSON grammar, both written with `fjs/bnf` combinators.
They were deleted rather than kept: nothing imported them, no proof covered
them, the JSON half restated lexical rules
[`fjs/bnf/testlib.f.mjs`](../bnf/testlib.f.mjs)'s `deterministic` already
covers, and a concrete media grammar does not belong in the compiler at all.

Their FunctionalScript half is also **stale by design**, which is why it was not
kept as an example: it separated statements by newline, and the language
requires `;`. Do not restore either file. The front end this package will hold
arrives by moving the existing one, per
[`todo/parser-serializer-restructure.md`](../../todo/parser-serializer-restructure.md);
git history has the deleted `id`/`alpha`/comment rules if they are ever wanted.

## Source files and repository migration

The FunctionalScript repository uses extensions to separate runtime source,
type-only source, source-language migration, and compatibility with the current
FunctionalScript compiler.

| Extension | Meaning |
|---|---|
| `.f.ts` | Authored FunctionalScript-intent TypeScript implementation/proof source. **No longer used**: stage 1 removed the last one, and new source must not use this extension. It appears below only to describe that completed migration. |
| `.f.mjs` | Authored FunctionalScript-intent ESM JavaScript with JSDoc types. It may use FunctionalScript features the current parser/compiler does not support yet. |
| `.f.js` | Not authored, and not produced by any build or packaging step. Stage 1's TypeScript runtime emission produced it; that pass is gone ([#1520](https://github.com/functionalscript/functionalscript/pull/1520)), so nothing generates tracked `.f.js` source. `fjs compile <input> <output>.f.js` does still write one, to a path the caller names — that is the compiler's output for a user, not repository source. The extension is reserved for stage 2, where it becomes authored FunctionalScript that the current parser/compiler must accept. |
| `types.ts` | Authored TypeScript source for a type-level API. It may coexist with `.f.mjs` or later `.f.js` and holds no runtime implementation. |
| `.d.ts`, `.d.mts` | Generated TypeScript declarations. |

The migration is deliberately split into two implementation stages, both
described below; this file is the repository-wide plan now that stage 1 is done
and its issue deleted. The package conventions are documented in
[`fjs/ci/todo/publishing-packages.md`](../ci/todo/publishing-packages.md).

### Stage 1: remove authored TypeScript implementations

**Stage 1 source conversion is complete** — no authored implementation or proof
`.f.ts` remains, so every rename described in this section has already happened.
It is kept as the record of what the extensions mean and why; write new source as
`.f.mjs` plus, where a type-level API is separately useful, `types.ts`.

Two prerequisites were written to gate the first real conversion. Neither was
met as written; both were de-scoped, and what replaced them is the record:

1. [authored `.mjs` package support](../ci/todo/f-mjs-package-support.md) —
   `allowJs` / `checkJs`, authored `types.ts`, declaration emission, Deno
   validation, package inclusion, and clean-consumer tests. What the migration
   needed from it was the validation itself, performed once and recorded in
   [`packed-consumer-validation.md`](../ci/packed-consumer-validation.md); the
   committed CI fixture stays open as regression work in that issue, not as a
   migration gate.
2. [`.f.mjs` test and coverage fixtures](../emergent_testing/todo/f-mjs-test-and-coverage.md)
   — moot once every conversion had happened. The repository itself now supplies
   the evidence the synthetic fixture was designed to give in advance: every
   `module.f.mjs` is loaded through its proof under Node and Deno coverage.

Package and publish jobs run from a clean CI checkout, so neither prerequisite
required developer-worktree cleanup or tracking ignored outputs from earlier
revisions.

The renames went runtime dependency leaves first:

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

This stage was independent of FunctionalScript parser coverage, and the meaning
survives it: `.f.mjs` means FunctionalScript-intent JavaScript, not a
compiler-compatibility promise. A `.f.ts` implementation moved once its authored
runtime dependencies could, even where the current compiler cannot parse every
feature it uses.

The transition was asymmetric for runtime dependencies: a remaining `.f.ts` could
depend on already migrated `.f.mjs`, while migrated `.f.mjs` could not runtime
import a remaining implementation `.f.ts`. Cycles migrated as coherent groups.
Type-only APIs stayed in authored `types.ts` and did not participate in that
runtime ordering.

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

Migrated JavaScript could not retain a type-only source edge to a remaining
**implementation** `.ts` / `.f.ts` either, and no such file is left to point at.
The placement rule it enforced is the part that outlives stage 1: a type that
should survive independently of one implementation belongs in `types.ts`; one
that is naturally local to the implementation and expressible in JSDoc stays with
it.

A declaration-only file is `types.ts` rather than `.f.mjs`, and an existing
`.f.mjs` that turns out to be runtime-empty should move the same way.
`fjs/types/phantom`, whose `Phantom` type uses a type-only `declare const
phantomKey: unique symbol`, is the worked example: `module.f.ts` became
[`types.ts`](../types/phantom/types.ts) with no runtime `Symbol()` value
invented for it. The repository has no runtime-empty `.mjs` left — the three
files with no `export` are executables (`fjs/module.mjs`,
`fjs/emergent_testing/all.test.mjs`, `fjs/types/bigint/benchmark.mjs`), not
declaration modules — so the rule now applies to new source only.

`types.ts` is ordinary TypeScript source, so the normal TypeScript check validates
it even while `skipLibCheck` remains enabled for `.d.ts` dependencies. No
`.gitignore` exception or declaration-file checking policy is needed for authored
type source.

The package behavior of permanent `types.ts` was validated before the first real
migration. With `rewriteRelativeImportExtensions: true`, the package fixture had
to establish how references to `./types.ts` from both `.ts` and `.mjs` appear in
emitted declarations, which generated `types.js` / `types.d.ts` files are
required, and that TypeScript, Node, Deno, and Bun can consume the packed result.
That experiment ran in
[#1520](https://github.com/functionalscript/functionalscript/pull/1520): only
`types.d.ts` is required, generated `types.js` is not, and the runtime-emission
pass is gone — `prepack` emits declarations and then re-checks the tree with
them present, so declaration-emit degradation still fails packaging.

Proofs followed the same runtime source-language rule and completed the same
move, so a `module.f.mjs` is accompanied by a `proof.f.mjs`. Type-only APIs may
remain in `types.ts`. Current FunctionalScript compiler support was never a
condition for that rename.

#### Private types

Authored `.mjs` files carry no file-scope JSDoc `@typedef` — anywhere in the
repository (see the repository-wide rule in the root `AGENTS.md` and
`fjs/AGENTS.md` §3.2). A named type migrating out of a `.f.ts` therefore lands
in the sibling `types.ts` (when it is part of the public declaration closure),
in an optional sibling `private.ts` (implementation-private types outside that
closure), inline in the annotations that use it, or — for compile-time proof
types — function-local in a proof.

Private types and private runtime constants keep a leading `_`, even when
linkage requires an export. The underscore is an API contract, not
declaration-level visibility: generated `.d.ts` / `.d.mts` may still contain
`export type _Type = number`, but names that begin with `_` are private
FunctionalScript implementation details. Consumers must not rely on
those names directly, so renaming or removing a `_`-prefixed name is not a
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

Public types keep ordinary names without the `_` prefix. Which types are public
is an API design decision, not a mechanical restatement of what the
pre-migration `.f.ts` file happened to export: a helper that belongs to the
module's public vocabulary may be published under an ordinary name even though
its TypeScript alias was module-private, and a former export may become `_`
when it only ever described an implementation detail.

No generated `private.d.ts` ships: `package.json`'s `files` excludes them with
a `!**/private.d.ts` negation.

What CI checks is the consequence, not the exclusion. Every declaration the
package does carry is type-checked as an outside consumer installs it, so a
public declaration that came to depend on a private module is a red build
rather than a broken package. Losing the negation itself is *not* caught: the
private declarations come back, every reference to them resolves, and that job
stays green. It is one line, and losing it is a visible diff in review — see
[`../ci/todo/f-mjs-package-support.md`](../ci/todo/f-mjs-package-support.md)
for why an assertion over the packed listing was written for that and then
removed.

The `_` contract is permanent and independent of that. `_` helpers retained in
`types.ts` by the public declaration closure, and exported `_` constants, keep
shipping in emitted declarations; they are still not API.

Both end-of-stage-1 cleanups are done. The TypeScript runtime-emission pass is
removed ([#1520](https://github.com/functionalscript/functionalscript/pull/1520)
measured that package resolution does not require a generated `types.js`), while
`prepack` keeps a no-emit re-check with declarations present:
`tsc --noEmit false --emitDeclarationOnly && tsc`. The blanket `**/*.js` rule is
gone from `.gitignore`
([#1545](https://github.com/functionalscript/functionalscript/pull/1545)) — no
build or packaging command generates repository `.js` any more, so it guarded
only stale artifacts in pre-existing working trees. `fjs compile` writing a `.js`
or `.f.js` to a path inside the checkout is now visible as an untracked file
rather than silently ignored, which is the intended behavior for output a caller
asked for. `**/*.js` deliberately stays in `package.json`'s
`files`, because the extension may be used again later; a publish must come from
a clean checkout either way. Authored `types.ts` files remain.

### Stage 2: mark compiler-compatible FunctionalScript

The repository compiler-compatibility migration is
[`todo/fjs-nanvm-integration.md`](../../todo/fjs-nanvm-integration.md). Stage 1
was its first blocker and is complete, so what remains before its first rename
is [authored `.f.js` package support](../ci/todo/f-js-package-support.md), so a
standalone `.f.js` is directly type-checked, receives a `.d.ts`, is packed in
the clean CI package build, and resolves for a clean consumer. That is the one
gate now, and it matches the `**Blocked by:**` list in the integration issue.

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
