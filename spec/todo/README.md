# Language Specification: To Do

Documents for language features that the `fjs` parser does **not** recognize
yet, and design documents for parts of the system that are not implemented.
Each file is a working draft: it may mix specification text with design
notes, alternatives, and implementation sketches.

When the parser recognizes a feature, its document is folded into the single
[language specification](../README.md) — the one document that describes what
the compiler accepts today — and this file's entry is removed. The numbering
below is this directory's own; the specification has no section numbers.

## 1. JSON

1. [ ] [undefined-property](./1010-undefined-property.md).

## 2. DJS

### 2.1. Module structure

1. [ ] [import-attributes](./2140-import-attributes.md) — `with { type: "json" }`,
   which JavaScript requires of a JSON import and the parser does not accept,
   and `with { type: "text" }`, a file imported as a string.

### 2.2. Priority 1

We need it to use JSDoc and TypeScript.

1. [ ] [namespace-import](./2220-namespace-import.md).

### 2.3. Priority 2

1. [ ] [property-accessor](./2330-property-accessor.md),
2. [ ] [operators](./2340-operators.md),
3. [ ] [has-own-property](./2345-has-own-property.md) — proposal stage;
   argues against adding `in` and for a pattern-recognized `hasOwn`
   alongside `own_property` instead,
4. [ ] [grouping](./2350-grouping.md),
5. [ ] [built-in](./2360-built-in.md),
6. [ ] property key as number — `{ 3e+7: true }` (no leading sign allowed),
7. [ ] computed property key from an expression — `{ [name]: 0 }`. The
   constant-string form is implemented
   ([property keys](../README.md#property-keys)); the general one waits
   on expressions.

### 2.4. Syntactic Sugar

1. [ ] [shorthand](./2440-shorthand.md),
2. [ ] [destructuring](./2450-destructuring.md),
3. [ ] [js-string-literals](./2460-js-string-literals.md).

## 3. FJS

The FJS can have functions. The format requires additional run-time
information for serialization: an FJS value can't be serialized without it —
see [serialization](./serialization.md).

|format|any     |    |Notes                          |
|------|--------|----|-------------------------------|
|FJS   |function|Func|[function](./3110-function.md) |

### 3.1. Required

1. [ ] [function](./3110-function.md)
2. [ ] [parameters](./3120-parameters.md)
3. [ ] [body-const](./3130-body-const.md)
4. [ ] [forward-references](./3140-forward-references.md)

### 3.2. Priority 2

1. [ ] `if`. See https://developer.mozilla.org/en-US/docs/Glossary/Falsy
2. [ ] [let](./3220-let.md)
3. [ ] `while`
4. [ ] [export](./3240-export.md)
5. [ ] Ownership of Mutable Objects (Singletons). Wanted for local mutability
   ([mutability](./mutability.md)), **not** for I/O: effects keep I/O state in
   the runner ([io-effects](./io-effects.md)).

### 3.3. Priority 3

1. [ ] Regular Expressions.
2. [ ] [type-annotations](./3360-type-annotations.md)
3. [ ] [type inference](./3370-type-inference.md)
4. [ ] [promise](./3380-promise.md). Needed for JavaScript interop only —
   I/O is done with effects and requires no promises
   ([io-effects](./io-effects.md)).
5. [ ] [class](./3390-class.md)
6. [ ] Temporal classes. See https://github.com/functionalscript/functionalscript/pull/801

### 3.4. Syntactic Sugar

1. [ ] [expression](./3410-expression.md)
2. [ ] [one-parameter](./3420-one-parameter.md)
3. [ ] [assignments](./3430-assignments.md)
4. [ ] [template-literals](./3440-template-literals.md)
5. [ ] `async`/`await`. Depends on the implementation of promises.

## 4. ECMAScript Proposals

1. [ ] [Type Annotations](https://github.com/tc39/proposal-type-annotations), Stage 1:
   - [Node.js](https://nodejs.org/en/learn/typescript/run-natively),
   - `Deno` supports TypeScript,
   - `Bun` supports TypeScript,
   - most browsers don't support the feature.
2. [ ] [Pipe Operator `|>`](https://github.com/tc39/proposal-pipeline-operator), Stage 2.
3. [ ] [Records and Tuples](https://github.com/tc39/proposal-record-tuple), **withdrawn**
   (the repository was archived in April 2025):
   One problem with such records and tuples is that they can't hold safe, immutable functions. Maybe we need something like `#(a) => a * 2`.
4. [ ] [Pattern Matching](https://github.com/tc39/proposal-pattern-matching), Stage 1.
5. [ ] [Safe Assignment Operator](https://github.com/arthurfiorette/proposal-safe-assignment-operator).
6. [ ] [Temporal](https://github.com/tc39/proposal-temporal).

Wish list:

1. [ ] Utf8 String. Something like `u8"Hello, world"`.

## Design documents

Design decisions and sketches for the unimplemented parts of the system,
moved here from the main spec README and keeping their old section numbers:

|Document|Topic|
|--------|-----|
|[io-effects](./io-effects.md)|§5 — I/O with effects: `Effect`, operations, runners|
|[content-addressable-vm](./content-addressable-vm.md)|§6 — content-addressable VM, hashing|
|[object-identity](./object-identity.md)|§7 — object identity, custom dictionaries, `Map`|
|[mutability](./mutability.md)|§8 — mutable objects and ownership tracking|
|[serialization](./serialization.md)|§9 — EDAG as data, CBOR, bytecode as VM-internal|
|[vm-command-format](./vm-command-format.md)|NPN command format of the VM|
|[design-principles](./design-principles.md)|design principles of the "ideal" FS 0.*|
