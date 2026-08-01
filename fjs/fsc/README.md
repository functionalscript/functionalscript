# FunctionalScript Compiler

## Source files and incremental repository migration

The FunctionalScript repository uses file extensions to distinguish authored
source, generated output, and the subset accepted by the current
FunctionalScript compiler.

| Extension | Meaning |
|---|---|
| `.f.ts` | Authored FunctionalScript-intent TypeScript. It may use TypeScript syntax or FunctionalScript features that the current parser does not support yet. |
| `.f.mjs` | Authored FunctionalScript ESM JavaScript with JSDoc types. The complete module must be accepted by the current FunctionalScript parser and compiler. |
| `.f.js` | Generated JavaScript emitted from `.f.ts`; never authored directly. |
| `.d.ts`, `.d.mts` | Generated TypeScript declarations. |

The general authored/generated JavaScript convention is described in
[`fjs/ci/todo/publishing-packages.md`](../ci/todo/publishing-packages.md).
The `.f.mjs` extension adds a stronger FunctionalScript-specific promise: it
marks a module that is ready for translation by the compiler available in the
same revision of the repository.

Repository migration is incremental, not a single task or pull request. A
synthetic `.f.mjs` compiler fixture may be added as soon as the parser supports
it. Before converting the first existing repository module, complete both:

- [`.f.mjs` test and coverage support](../emergent_testing/todo/f-mjs-test-and-coverage.md),
  so migrated modules remain in proof discovery and coverage reporting;
- the authored-`.mjs` tasks in
  [`publishing-packages.md`](../ci/todo/publishing-packages.md), including
  TypeScript checking, `.mjs`/`.d.mts` package inclusion, declaration emission,
  and package import tests, so published imports cannot reference omitted files.

Migration uses a dependency-closed order. An existing module is eligible only
when every relative FunctionalScript runtime dependency it imports is already
`.f.mjs` or is converted in the same coherent group. Authored `.f.mjs` must not
import an unmigrated `.f.ts` module or generated `.f.js` output. Packaging copies
`.mjs` source without rewriting its import specifiers, so this rule keeps the
same source graph valid in a clean checkout and in the packed NPM artifact. If a
module's dependency closure is not yet eligible, leave it as `.f.ts`; this plan
does not introduce a staging or package-time import-rewrite mechanism.

1. As soon as the parser supports the first useful function modules, select an
   existing dependency-closed `.f.ts` module or coherent group whose complete
   syntax is supported.
2. Rename the selected files to `.f.mjs` and replace TypeScript-only syntax with
   JSDoc types.
3. Update imports within the group and all importers of renamed modules to the
   authored `.f.mjs` paths.
4. Add the group to parser/compiler validation and preserve its existing proof,
   coverage, type-checking, and package-publication expectations.
5. Repeat as each new parser feature makes more dependency-closed groups
   eligible.

A file stays `.f.ts` until all syntax it uses and the required dependency closure
are supported. Migration must not require implementing unrelated language
features merely to convert a file. Likewise, `.f.mjs` must not be used as an
aspirational label: once a module has that extension, accepting and compiling it
is a compatibility requirement.

The migration grows real-repository compiler coverage alongside the parser and
code generator. It does not wait for the complete FunctionalScript feature set,
and compiler progress does not wait for the entire repository to migrate. See
the [project roadmap](../../todo/plan/roadmap.md) and the
[fjs–nanvm integration plan](../../todo/fjs-nanvm-integration.md).

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
