# FunctionalScript Compiler

The front end: a grammar-based tokenizer over
[`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs), the
[parser](./parser/README.md), the [AST](./ast/module.f.mjs), and the
[transpiler](./transpiler/module.f.mjs) behind `fjs compile`. It moved here
from `fjs/djs` as stage 5a of
[`todo/parser-serializer-restructure.md`](../../todo/parser-serializer-restructure.md);
what stayed there is the old serializer and the value types, and the issues in
`fjs/djs/todo/`, which follow once stage 4 lands. `fjs compile` writes through
[`fjs/media/datajs/serializer`](../media/datajs/serializer/module.f.mjs)
since stage 6: its module output is a DataJS document in normalized form, and
its `.json` output refuses what JSON cannot spell rather than approximating
it — see [`module.f.mjs`](./module.f.mjs).

What the compiler accepts today is the data language the sections below call
DJS, and the roadmap is theirs too. The classical grammars this package once
held were deleted rather than kept: nothing imported them, no proof covered
them, and their FunctionalScript half separated statements by newline where
the language requires `;`. Do not restore them; git history has them.

## DJS, the accepted subset

- additional types: bigint

## Rules

- can serialize/deserialize without reading source code
  - no function serialization/deserialization

## AST

A DJS module parses into [ast/module.f.mjs](./ast/module.f.mjs); the types
in [ast/types.ts](./ast/types.ts) carry the shape and its invariants.

Why a flat list of constants with index references, rather than a value tree:
a DJS module denotes a **graph**, and `import` and `const` are how it names
the shared parts. Deserializing has to preserve that sharing — two properties
holding the same reference must yield the same object, not two equal copies —
so the AST keeps the constants addressable and refers to them by index
instead of inlining them. That is also what makes serialization a real
choice: a value referenced more than once is emitted as a `const` and reused.
See [examples/input.f.mjs](./examples/input.f.mjs).

## Both grammars are LL(1)

The tokenizer's grammar, [`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs),
and the parser's, [`parser/grammar`](./parser/grammar/module.f.mjs), are read
by [`fjs/ebnf/ll1`](../ebnf/ll1/README.md), which refuses a grammar that one
symbol of lookahead cannot decide, before any input. The classical grammars
they replaced were read by a backtracking backend, and neither was LL(1) as
spelled. Measured before the ports — the classical rule sets bridged into the
EBNF form, every rule's closure run through `parserRuleSet`, each conflict
masked once found so the next surfaced — they refused in eight shapes. The
table is the record of what each port changed and why; the ports' own issues
closed with them.

| grammar | rule | refusal | class |
|---|---|---|---|
| tokenizer | `multilineContent`: `end: ['*', '/']` beside `more: [char, …]` | first/first on `*` | grammar: left-factor the `*` |
| tokenizer | the `operator` variant, 56 literals | first/first on `=`, and on every shared prefix behind it | grammar: a prefix tree, built from the list — `literals` in `fjs/ebnf` |
| tokenizer | the `token` variant: `comment`, `['/', { oneline, multiline }]`, beside `operator`, which holds `/` and `/=` | first/first on `/` | grammar: left-factor the `/`, the shape of the `*` above. Not removed by the prefix tree — checked with the operator's first set kept whole — and masking a rule by replacement erased `/` from that set, which is how a first count missed it |
| tokenizer | `number`: `digits0`, then the `option({ bigint, frac })` | first/follow on the digits, and on `e`, `E`, `n` | the `numError` poison: `[idChar]` follows every optional part of a number, and `idChar` holds digits and letters. The number boundary is decided one layer up, over the token stream |
| tokenizer | `jsGrammar = repeat0Plus(token)`: the `idChar` repeat of `id`, the body of a `//` comment, its `option(newLine)`, the number's `{ numError: [idChar], ok: none }` itself, its `fracPart` on `.`, the exponent's sign option on `+` and `-`, and `multilineContent` | first/follow on the next token's first set | inherent to a whole-file grammar: a greedy token against the token after it. With the entry a single `token` the seven vanish — verified on the bridged set and on a two-rule grammar. The poison is the row above seen from outside the number: nullable, so its follow set is the next token's |
| parser | `statementEnd`: `[trivia, ';', …]` beside `[lineTrivia, 'nl', …]` | first/first on the trivia symbols | trivia leads both branches. Trivia follows every token instead, and `;` ends every statement — the newline terminator is gone, the design [parser-serializer-restructure](../../todo/parser-serializer-restructure.md)'s stage 5 decided |
| parser | `delimited`: `repeat0Plus([',', trivia, element, trivia])` then `option([',', trivia])`, once for arrays and once for objects | first/follow on `,` | the trailing comma, which rested on a failed round rewinding; spelled right-recursively, `item t [ ',' t [ items ] ]` |
| parser | the module's final `{ semicolon: [trivia, ';'], none: [] }`, then `trivia` | first/follow on the trivia symbols | trivia leads the option and follows it; gone with the `;` after every statement |

So each port was a grammar rewrite plus a backend swap, not a swap alone,
and the tokenizer also needed a token layer — a parser resumable at an
index, the loop over it being the tokenizer's — since a whole-file token
grammar is not LL(1) under a first/follow check. Maximal munch inside a token
comes for free, an optional round starting whenever the lookahead is in the
item's first set, once the punctuators are a prefix tree built from the
list. An earlier count through the classical `dispatchMap`, which had no
first/follow check, found three of the eight.

## Next steps

- [x] use JS tokenizer
- [x] identifiers `{a:5}`
- [x] computed keys `{["a"]:5}`, the only spelling of a `__proto__` key
  ([spec: the `__proto__` key](../../spec/README.md#the-__proto__-key))
- [x] big int
- [x] `export default ...`
- [x] constants
  ```js
  const a = [3]
  export default = { a: a, b: a }
  ```
  Serialization
  ```js
  const _0=[3];
  export default {a:_0,b:_0};
  ```
- [x] import
  ```js
  import a from 'c.f.js'
  export default { a: a, b: a}
  ```
- [ ] short form
  ```js
  const a = 5;
  export default { a }
  ```

Optional, for fun, syntax sugar:

- [x] comments. Ignore them. Not an error.
- [ ] double/single quote strings

## Decidable Language

- [ ] using operator and functions
  ```js
  const a = 2+2+Math.abs(5)
  export default { a: a }
  ```
- [ ] decidable functions?
  ```js
  const f = a => b => a + b
  export default f(1)(2)
  ```

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
