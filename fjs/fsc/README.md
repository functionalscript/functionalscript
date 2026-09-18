# FunctionalScript Compiler

The front end: a grammar-based tokenizer over
[`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs), the
[parser](./parser/README.md), the [AST](./ast/module.f.mjs), and the
[transpiler](./transpiler/module.f.mjs) behind `fjs compile`. It moved here
from `fjs/djs` when the parsers and serializers were restructured, and its
issues followed into [`todo/`](./todo/) when the old serializer was retired
and `fjs/djs` emptied; the value model is DataJS's,
[`fjs/media/datajs/types.ts`](../media/datajs/types.ts). `fjs compile` writes
the language its output name declares: a `.data.js` document through
[`fjs/media/datajs/serializer`](../media/datajs/serializer/module.f.mjs) in
normalized form, a `.js` module through [`serializer`](./serializer/module.f.mjs)
from the linked graph, and a `.json` output that refuses what JSON cannot
spell rather than approximating it — see [`module.f.mjs`](./module.f.mjs).

What the compiler accepts today is the data language the sections below call
DJS, and the roadmap is theirs too — plus property access, `a.b`, `a[0]`
and `[1].length`, on any value, a numeric literal included, since `-` is an
operator the grammar reads and `-1 .x` is the negation of the access as
JavaScript has it: an own property of the
base, never the prototype chain, as
[spec: property accessor](../../spec/todo/2330-property-accessor.md) has
it — a name a built-in prototype gives a value, `a.toString` or `a.push`,
is refused at the key rather than read as `undefined` where JavaScript
finds a function, `length` excepted, since a value owns it
([`fjs/js/prototype`](../js/prototype/module.f.mjs)); `undefined` where
there is no such property; and a `null` or `undefined` base is the one
failure a data module can make, reported as JavaScript's throw is. The sharing sweep reads an access by the keys it applies, so
`{ x: cfg.a, y: cfg.b }` is the tree it is and `[cfg.a, cfg.a]` the shared
node it is. A function, `(...a) => body`, is written by the EDAG and
FunctionalScript outputs — see below — and refused by the value outputs,
since a value has no function in it. Across modules the sweep is coarser: a module whose own value
holds a shared node is shared under any route an importer takes into it,
`m.selected` included, and the modules it reaches count under any route
too, since where in the module's value a node sits is not carried, and
refusing is the answer that never writes a node twice. The classical grammars this package once
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

An object is `['object', members]`, the members in the order written and a
repeated key written twice, rather than a plain object: `run` builds the
object JavaScript builds from the same literal — a repeated key at its first
position with its last value, integer-like keys first — and the EDAG object
constructor takes the members as written, which only the syntax still has.
See [examples/input.f.mjs](./examples/input.f.mjs).

## EDAG

A parsed module also compiles to an [EDAG](../edag/README.md) —
[edag/module.f.mjs](./edag/module.f.mjs), Stage 1 of
[compile-modules-to-edag](./todo/compile-modules-to-edag.md). `unresolved`
compiles it over its imports, before any import is read: import `i` is the
parameter `['.', ['args'], i]`, a `const` is one node however many references
reach it, and the export is the root; the specifiers ride beside the graph as
`Unresolved`, a compiler's structure and no part of EDAG. `resolve` links a
program from its root path into one EDAG: each import is read, parsed and
resolved the same way, recursively, and bound in its parameter's place — the
binding happens where a reference is lowered, so the graph is built once with
the imported module's node where its parameter would be — and a module met
twice in one link is one node, so a diamond of imports joins where it should.
A property access, `a.b` or `a[0]`, is the EDAG's `['.', base, key]`, its
key a constant the parser admitted — `__proto__` and `constructor` refused at
the key.
A JSON module, imported `with { type: "json" }`, is the tree its document
denotes, as `transpile` reads it; a `.json` file imported without the
attribute, or another file imported with it, is refused as JavaScript refuses
it.
`fjs compile` writes the linked graph when the output name ends with
`.edag.data.js` or `.edag.data.mjs`, as a DataJS document with its shared
nodes hoisted as the DataJS output's are, and writes it back as source under
any other `.js` or `.mjs` name, through
[`serializer`](serializer/module.f.mjs) — the one output that holds a
function, since a value has none. What
the export does not reach is anchored by the comma operation rather than
dropped, `[',', [...roots, exported]]`: `transpile` reads every import and
`run` evaluates every `const`, so a failure behind an unused one fails the
compile, and the graph keeps the computation the same way — its operands the
roots of the unreached part in source order, an entry another unreached entry
reaches being anchored through it, an alias being the node it names, and two
imports of one module being one node. A module the export reaches entirely
has no comma.
A function is `['=>', null, body]`: no frame yet, and the body a scope of
its own, in which the rest parameter is `['args']` — one node however many
references reach it, so `(...a) => [a, a]` shares as JavaScript does — and
nothing outside stands: a reference to a `const`, an import or an enclosing
function's parameter is a capture, refused where it is written, so no module
node is ever shared into a body. The body is any value except an object, since
`=> {` opens a block in JavaScript — or that block, in which an object is a
value again: any number of `const` statements and then one `return`. A body
`const` is an entry of the function's own body, as a module `const` is of the
module — one node however many references reach it, and what the returned
value does not reach anchored by the comma rather than dropped, which is the
one place a comma stands outside a module's root. With no statement the block
lowers to the value it returns, the two spellings being one function.
A `-` before a value is the unary minus, `['-', exp]` — `op12` of one operand
— and the language's only operator. It is no part of the literal after it, so
`-1` is the negation of `1` in the parser's tree, and the lowering folds that
one case back into the leaf: negating a numeric literal is exact arithmetic,
so the graph holds the number and [`rust`](rust/module.f.mjs) prints it. A
negation of anything else stays a node — folding one would mean saying what a
container converts to — and that route refuses one, `Neg for Any<A>` answering
a `Result` a module cannot hold. It binds looser than a
step, as it does in JavaScript, so `-1 .x` is `-(1 .x)` and `-1()` is `-(1())`
— which is what retired the two refusals the old fold needed, an access and a
call on a numeric literal alike. What it takes is JavaScript's
`UnaryExpression`, so not a function: `-(...a) => 1` is a syntax error in
both, and the writer gives a negated function a `const` of its own, as it does
an access base.
A call is a step after a value, as an access is, and the callee picks which of
the EDAG's two forms it lowers to: an access as the callee is a method call,
`a.b(c)`, whose receiver is that access's base, so the access owns the call
and the two are one node, `['.', a, 'b', ['|()', args]]`; any other callee is
the plain `['()', callee, args]`, its arguments one array node the call
spreads. The plain form over an access is the *detached* receiver,
`(0, a.b)(c)`, which needs the comma operator and is unspellable, so no
source writes one — `(a.b)(c)` keeps the receiver and is the method call
again, parentheses preserving the property reference. A call mints identity — two calls are
two nodes and a `const` naming one is one — which is what a body's `const`
keeps. [`serializer`](serializer/module.f.mjs) has no spelling for either
form yet and refuses both by name, so a module with a call in it compiles to
the EDAG output alone. When it gets one, a negative callee needs the care an
access base takes: `-1()` is `-(1())`, so `['()', -1, args]` cannot be
written `-1()` — a group would say it, `(-1)()`, and until the grammar has
one ([`todo/grouping.md`](todo/grouping.md)) a `const` does. The writer's
proof refuses that shape by name, so the question comes up where the
spelling is written.
A member a later duplicate shadows is in the graph, since the constructor
applies every member written, so a reference in it is reached here where the
sharing decision, which reads the value, does not count it.

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
| parser | `statementEnd`: `[trivia, ';', …]` beside `[lineTrivia, 'nl', …]` | first/first on the trivia symbols | trivia leads both branches. Trivia follows every token instead, and `;` ends every statement — the newline terminator is gone, which is the rule [`spec/README.md`](../../spec/README.md) states |
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
invented for it. The repository has no runtime-empty `.mjs` left — the files
with no `export` are executables (`fjs/module.mjs`,
`fjs/emergent_testing/all.test.mjs`), not declaration modules — so the rule now
applies to new source only.

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

## The token layer is JavaScript's, the parser is the subset

Decided with the retirement of the hand-written scanner, and not to reopen
without a reason. The grammar's tokens,
[`fjs/ebnf/lib/js`](../ebnf/lib/js/module.f.mjs) read by
[`fjs/js/tokenizer`](../js/tokenizer/module.f.mjs), grow toward the whole
JavaScript lexical surface, because everything that reads a `.f.mjs` — this
compiler, the website's highlighter, a linter — needs the same tokens, and a
token that is recognised is not thereby accepted: the compiler's fold and
grammar refuse what the language does not admit, at the token, as they refuse
`--` — the decrement operator, one token the fold turns into an error because
the language has no rule for it. The rules the grammar shares with JSON flow the other way — it imports
JSON's digit and string rules from `fjs/ebnf/lib/json`, and no codec reads
this grammar — so widening it regresses no codec. The parser stays the
FunctionalScript grammar, LL(1) over those tokens, and grows one production
at a time as the EDAG stages ask.

A full ECMAScript parser with a filter behind it — accept everything, then
decide from the tree what is FunctionalScript — was considered and refused.
It is not LL(1) (ASI, cover grammars, contextual keywords,
regex-or-division), so it would be the hand-written surface the grammar
route exists to avoid; the subset law needs only that what is accepted means
what JavaScript means, which the LL(1) grammar and the engine-as-oracle
proofs give; and nothing open needs a JavaScript parse tree, the views and
the linter needing tokens. What a full parser would buy — a message naming
the construct refused rather than the token — is an error production in the
subset grammar, where it earns its place. Where the rest of `fjs/js` lives
afterwards is a later rename and no part of this decision.

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
