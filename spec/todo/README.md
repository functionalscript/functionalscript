# Language Specification: To Do

Documents for planned language features and remaining system design work.
Some features are implemented but retain open approval, proof or follow-up
tasks; their current behavior is specified in the [language specification](../README.md).
Each file is a working draft: it may mix specification text with design
notes, alternatives, and implementation sketches.

When the parser recognizes a feature, its implemented behavior is folded into the single
[language specification](../README.md) — the one document that describes what
the compiler accepts today. A design record and its entry remain here while
explicit work is still open, and are removed when that work is complete. The numbering
below is this directory's own; the specification has no section numbers.

## Compatibility invariants — P1

The [language principles](../principles/README.md) define source inclusion,
successful-result agreement, purity and indistinguishable execution failures.
[Preserve JavaScript compatibility](../../todo/fjs-javascript-compatibility.md)
tracks the current and proposed P1 violations and their root-cause corrections.
These rules apply at every stage, regardless of a feature's priority below.

[Refused constructs](./refused-constructs.md) lists the valid JavaScript the
compiler refuses, and why.

[Statement-aware intrinsics](../../fjs/compiler/parser/todo/statement-aware-intrinsics.md)
requires every instruction pattern to match already-recognized statements and
expressions, never raw token sequences. JavaScript-compatible statement
termination is in the language
([module structure](../modules/README.md)); canonical output and
DataJS's required-semicolon format did not change.

### TypeScript boundary

**TypeScript is not a FunctionalScript source dialect.** Drop the active plan
to accept TypeScript-only syntax and erase it before execution. This covers
`import type`, `export type`, inline type annotations, type assertions and
other TypeScript-only declarations, not merely one import spelling. The shared
front end parses JavaScript; neither a filename nor a host's TypeScript loader
may enable a stripping/transpilation path around the original-source rule.
Accepting such syntax remains a **P1 compatibility violation**.

TypeScript remains an external checker for JavaScript with JSDoc and separate
`types.ts`/`.d.ts` companions; these are tooling, not an additional FunctionalScript
source language. Existing type-check commands, declarations and implementation type
files remain in place. [RTTI comment annotations](./3360-type-annotations.md)
are a separate design written inside JavaScript comments, not TypeScript syntax;
this decision neither implements nor retires that design.

Reconsider inline erasable syntax only after it is part of ECMAScript and
supported by the declared execution environment. The
[blocked standard-annotations task](../../todo/blocked/js-extension-type-annotations.md)
records that trigger; it does not direct or block current development. A future
proposal must use the actual standardized syntax, not assume that all of
TypeScript, or today's `import type`/`export type` spellings, becomes JavaScript.

## 1. JSON

1. [ ] [undefined-property](./1010-undefined-property.md) — P1 observation and
   composition constraints, not universal undefined-as-absence equivalence.
2. [ ] [undefined-property-vm-layer](./1015-undefined-property-vm-layer.md)
   — representation choices must preserve those observations.

## 2. Modules without functions

### 2.1. Priority 1

1. [ ] [namespace-import](./2220-namespace-import.md) — runtime JavaScript
   namespaces, not type-only imports. JSDoc type references need no runtime import.

### 2.2. Priority 2

1. [ ] [property-accessor](./2330-property-accessor.md),
2. [ ] [optional chaining](./2335-optional-chaining.md) — `a?.b`, `a?.[k]`,
   `a?.(…)`; implemented
   ([optional chaining](../property-access/optional-chaining/README.md)), open for linked
   designer approval,
3. [x] enumerable presence — prohibit `Object.hasOwn`; [`entry`](../property-access/entries/README.md)
   reads the value and `hasEntry` beside it answers the presence,
4. [ ] [built-in](./2360-built-in.md),
5. [ ] [global-names](./2365-global-names.md) — a name ECMAScript defines
   globally is never a module's to bind; each name is reserved no later
   than `built-in` admits it, since admitting a name a module may already
   have bound is a breaking change, so the list may land a name at a time
   (its file says P3, not this list's P2),
6. [ ] property key as number — `{ 3e+7: true }` (no leading sign allowed),
7. [x] computed property key from an expression — `{ [name]: 0 }`
   ([property keys](../values/objects/README.md#property-keys)).
8. [ ] [the `in` operator](./2346-in-operator.md) — stays out of the language
   by design; open for designer approval
   (its file says P3, not this list's P2).

### 2.3. Syntactic Sugar

1. [x] shorthand members, `{ a }` ([objects](../values/objects/README.md));
   whether a reserved word that denotes a value, `NaN`, may stand as one is
   [literal-words-as-references](./2445-literal-words-as-references.md),
   at P5,
2. [ ] [destructuring](./2450-destructuring.md) — binding patterns in
   `const` and parameters, lowered to property reads and the spread; the
   design is approved and both halves implemented
   ([destructuring](../bindings/destructuring/README.md)), the elision
   included; the rest element is open,
3. [ ] [js-string-literals](./2460-js-string-literals.md),
4. [ ] number spellings beyond JSON's — `0o7`, `.5`, `1.`
   ([numbers](../values/numbers/README.md)); hexadecimal, binary and numeric separators are implemented;
   [binary design review](./2470-binary-literals.md) remains open for linked
   designer approval, as does the
   [numeric-separator design review](./2471-numeric-separators.md).
   Octal has no use case yet; `.5` lands with
   [`?.` before a digit](../../fjs/js/tokenizer/todo/optional-chain-before-digit.md),
5. [ ] names beyond ASCII — Unicode identifier characters and `\u` escapes
   in a name, `const é = 1` ([identifiers](../lexical/identifiers/README.md)),
6. [ ] the rest of JavaScript's trivia — VT, FF, NBSP and the other `Zs`,
   U+FEFF (a leading BOM too), U+2028/U+2029 outside a string, a leading
   hashbang line — each recognized, or its refusal justified as
   [DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)
   asks ([whitespace](../lexical/whitespace/README.md)),
7. [ ] import attribute spellings — a string key, `with { "type": "json" }`,
   a trailing comma and an empty `with {}`
   ([importing](../modules/imports.md)).
8. [x] an omitted `;` where ECMAScript's automatic semicolon insertion
   permits one ([module structure](../modules/README.md)).
9. [x] spread, in an array literal and a call's arguments and in an object
   literal ([spread](../values/arrays/README.md#spread),
   [object spread](../values/objects/README.md#object-spread)).

## 3. Functions

A function cannot be serialized as data without additional run-time
information — see [serialization](../design/serialization.md) and
[functions](../functions/README.md).

### 3.1. Required

1. [x] function — in the language with either body and a parameter list
   that is empty, rest-only, fixed named (`a => …`, `(a, b) => …`) or fixed
   plus rest (`(a, b, ...x) => …`), capturing what its body names from the
   scopes around it
   ([functions](../functions/README.md))
2. [ ] [named and rest parameters](./3120-parameters.md) — the syntax, the
   fixed `arg`/`rest` EDAG bindings and the callable factories have landed;
   represented interpreters and compiled native functions now render
   EDAG-derived text ([function text](../../fjs/edag/function-text.md)).
   The design record retains approval and migration-proof work plus the
   separate native/AOT metadata-association follow-up
   (at most 16 fixed parameters: [functions](../functions/README.md))
3. [x] body-const — a function body takes `const` statements before its
   `return`, and the writer spells them
   ([functions](../functions/README.md))
4. [ ] [forward-references](./3140-forward-references.md) — a function
   calling itself landed ([functions](../functions/README.md)); a later
   `const`, and so mutual recursion, is open
5. [x] `export const`, named-only and mixed modules
   ([exports](../modules/exports/README.md)).

### 3.2. Priority 2

1. [x] `if` — the terminating guard, `if (c) { … return v; }` or a `throw`,
   before the body's own terminator; surface syntax over `?:`, no new EDAG
   node ([functions](../functions/README.md)). The bare consequent, a
   non-terminating branch with `else`, and the module-level guard are
   follow-ups.
2. [x] [let](./3220-let.md) — the one-variable loop, `let x = init;` and
   its `while`, is in the language ([loops](../control-flow/loops/README.md)); several
   variables, `break`, `continue`, `for` and a `let` outside a loop are
   open in the record
3. [x] `while` — with `let` above; `while` over several variables, and
   `break` and `continue` in its block, are open there
4. [x] [switch](./3230-switch.md) — the terminating `switch`, every case a
   guard's block and `default` last, is in the language
   ([switch](../control-flow/switch/README.md)); surface syntax over `?:` and
   `===`, no new EDAG node. The brace-less case, `break` and the
   module-level `switch` are open in the record
5. [ ] Ownership of Mutable Objects (Singletons). Wanted for local mutability
   ([mutability](../design/mutability.md)), **not** for I/O: effects keep I/O state in
   the runner ([io-effects](../design/io-effects.md)).
6. [x] `throw` — a panic as a statement, in a function body and at module
   level ([functions](../functions/README.md),
   [module structure](../modules/README.md)); with `if` it is what
   `assert` needs.

### 3.3. Priority 3

1. [ ] Regular Expressions.
2. [ ] [RTTI comment annotations](./3360-type-annotations.md) — JavaScript
   comments naming schemas, not inline TypeScript syntax.
3. [ ] [type inference](./3370-type-inference.md)
4. [ ] [promise](./3380-promise.md). Needed for JavaScript interop only —
   I/O is done with effects and requires no promises
   ([io-effects](../design/io-effects.md)).
5. [ ] [class](./3390-class.md)
6. [ ] [arity and complete arguments](./arity-complete-arguments.md) — an
   alternative for arbitrary length/full-argument construction; not a
   prerequisite for named and rest parameters.

### 3.4. Syntactic Sugar

1. [ ] [assignments](./3430-assignments.md)
2. [x] [Untagged template literals](../values/template-literals/README.md), lowered to
   the existing `String` and binary `+` operations.
3. [ ] `async`/`await`. Depends on the implementation of promises.
4. [ ] [default parameters](./3125-default-parameters.md) — `(a = 1) => …`
   and `{ a = 1 }` in a pattern, lowered to an `undefined` test, the
   parameters from the first default on read from the rest array so that
   `length` is JavaScript's; no new EDAG node. Parameter defaults are
   implemented ([functions](../functions/README.md)); pattern defaults and
   the designer approval remain open.
5. [x] [call statements](../functions/call-statements/README.md) — `assert(a);`, a
   call evaluated for its failure, lowered as an unread `const` to the `,`
   anchor; no new EDAG node.

### 3.5. Priority 4

1. [ ] [shadowing](./3150-shadowing.md) — a nested function must not reuse a
   name an enclosing scope binds; a warning or an error, undecided.
2. [ ] [export lists](./export-lists.md) — investigate options for `export { ... }`.

### 3.6. Priority 5

1. [ ] [definite assignment](./3225-definite-assignment.md) — `let x;`
   admitted where every path assigns `x` before it is read,
   `let x; if (c) { x = 2; } else { x = 3; }` denoting what
   `const x = c ? 2 : 3` denotes; refused by design until then
   ([variables](../bindings/variables/README.md)).

## 4. ECMAScript Proposals

1. [ ] [Type Annotations](https://github.com/tc39/proposal-type-annotations)
   — [blocked on ECMAScript standardization and runtime support](../../todo/blocked/js-extension-type-annotations.md).
   A host's TypeScript loader or stripping option is not ECMAScript support.
2. [ ] [Pipe Operator `|>`](https://github.com/tc39/proposal-pipeline-operator), Stage 2
   — [blocked on Stage 4 and runtime support](../../todo/blocked/pipeline-operator.md).
3. [ ] [Records and Tuples](https://github.com/tc39/proposal-record-tuple), **withdrawn**
   (the repository was archived in April 2025):
   One problem with such records and tuples is that they can't hold safe, immutable functions. Maybe we need something like `#(a) => a * 2`.
4. [ ] [Pattern Matching](https://github.com/tc39/proposal-pattern-matching)
   — [blocked on Stage 4 and native runtime support](../../todo/blocked/pattern-matching.md).
5. [ ] [Safe Assignment Operator](https://github.com/arthurfiorette/proposal-safe-assignment-operator).
6. [ ] [Temporal](https://github.com/tc39/proposal-temporal); for its classes,
   see [#801](https://github.com/functionalscript/functionalscript/pull/801).
7. [ ] [Import Text](https://github.com/tc39/proposal-import-text), Stage 3, and
   [Import Bytes](https://github.com/tc39/proposal-import-bytes), Stage 2.7:
   `with { type: "text" }` and `with { type: "bytes" }`, blocked on Stage 4
   ([import-text-bytes](../../todo/blocked/import-text-bytes.md)).

Wish list:

1. [ ] Utf8 String. Something like `u8"Hello, world"`
   ([blocked](../../todo/blocked/utf8-strings.md)).

## Specification structure

1. [ ] [spec-tree](./spec-tree.md) — split the specification into a tree of small
   per-feature pages, each owning the examples the compiler demos offer.

## Design documents

Design decisions and sketches for the unimplemented parts of the system live
in [`spec/design/`](../design/README.md): they are not open work, so they are
not here. The one design that is still an open task stays:

1. [ ] [cavm-function-to-string](./cavm-function-to-string.md) — function
   text in the CAVM: a call forwarding to the function's own hash.
