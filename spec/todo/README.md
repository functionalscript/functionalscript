# Language Specification: To Do

Documents for language features that the `fjs` parser does **not** recognize
yet, and design documents for parts of the system that are not implemented.
Each file is a working draft: it may mix specification text with design
notes, alternatives, and implementation sketches.

When the parser recognizes a feature, its document is folded into the single
[language specification](../README.md) — the one document that describes what
the compiler accepts today — and this file's entry is removed. The numbering
below is this directory's own; the specification has no section numbers.

## Compatibility invariants — P1

The [language principles](../README.md#principles) define source inclusion,
successful-result agreement, purity and indistinguishable execution failures.
[Preserve JavaScript compatibility](../../todo/fjs-javascript-compatibility.md)
tracks the current and proposed P1 violations and their root-cause corrections.
These rules apply at every stage, regardless of a feature's priority below.

[Statement-aware intrinsics](../../fjs/fsc/parser/todo/statement-aware-intrinsics.md)
requires every instruction pattern to match already-recognized statements and
expressions, never raw token sequences. It also plans JavaScript-compatible
statement termination and optional semicolons as a separate syntax expansion;
canonical output and DataJS's required-semicolon format need not change.

### TypeScript boundary

**TypeScript is not a FunctionalScript source dialect.** Drop the active plan
to accept TypeScript-only syntax and erase it before execution. This covers
`import type`, `export type`, inline type annotations, type assertions and
other TypeScript-only declarations, not merely one import spelling. The shared
front end parses JavaScript; neither a filename nor a host's TypeScript loader
may enable a stripping/transpilation path around the original-source rule.
Accepting such syntax remains a **P1 compatibility violation**.

TypeScript remains an external checker for JavaScript with JSDoc and separate
`types.ts`/`.d.ts` companions; these are tooling, not an additional FJS source
language. Existing type-check commands, declarations and implementation type
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

## 2. DJS

### 2.1. Priority 1

1. [ ] [namespace-import](./2220-namespace-import.md) — runtime JavaScript
   namespaces, not type-only imports. JSDoc type references need no runtime import.

### 2.2. Priority 2

1. [ ] [property-accessor](./2330-property-accessor.md),
2. [ ] [operators](./2340-operators.md),
3. [ ] [enumerable presence](./2345-has-own-property.md) — prohibit
   `Object.hasOwn`; propose a separate `hasEntity` AST pattern,
4. [ ] [built-in](./2360-built-in.md),
5. [ ] [global-names](./2365-global-names.md) — a name ECMAScript defines
   globally is never a module's to bind; lands before `built-in`, since
   admitting a name a module may already have bound is a breaking change
   (its file says P3, not this list's P2),
6. [ ] property key as number — `{ 3e+7: true }` (no leading sign allowed),
7. [ ] computed property key from an expression — `{ [name]: 0 }`. The
   constant-string form is implemented
   ([property keys](../README.md#property-keys)); the general one waits
   on expressions.

### 2.3. Syntactic Sugar

1. [ ] [shorthand](./2440-shorthand.md),
2. [ ] [destructuring](./2450-destructuring.md),
3. [ ] [js-string-literals](./2460-js-string-literals.md).

## 3. FJS

The FJS can have functions. The format requires additional run-time
information for serialization: an FJS value can't be serialized without it —
see [serialization](./serialization.md).

|format|any     |    |Notes                          |
|------|--------|----|-------------------------------|
|FJS   |function|Func|[functions](../README.md#functions)|

### 3.1. Required

1. [x] function — in the language with either body and a parameter list
   that is empty, rest-only, fixed named (`a => …`, `(a, b) => …`) or fixed
   plus rest (`(a, b, ...x) => …`), capturing what its body names from the
   scopes around it
   ([functions](../README.md#functions))
2. [ ] [named and rest parameters](./3120-parameters.md) — the syntax, the
   fixed `arg`/`rest` EDAG bindings and the callable factories have landed;
   what remains is the P1 default-text renderer, since a factory callable's
   `String` still shows its wrapper, and the plan's unticked proofs
3. [x] body-const — a function body takes `const` statements before its
   `return`, and the writer spells them
   ([functions](../README.md#functions))
4. [ ] [forward-references](./3140-forward-references.md)
5. [x] `export const`, named-only and mixed modules
   ([exports](../README.md#exporting-a-value)). The selected `types/range`
   candidate now parses its parameters and stops at its missing statement
   semicolons.

### 3.2. Priority 2

1. [ ] `if`. See https://developer.mozilla.org/en-US/docs/Glossary/Falsy
2. [ ] [let](./3220-let.md)
3. [ ] `while`
4. [ ] Ownership of Mutable Objects (Singletons). Wanted for local mutability
   ([mutability](./mutability.md)), **not** for I/O: effects keep I/O state in
   the runner ([io-effects](./io-effects.md)).

### 3.3. Priority 3

1. [ ] Regular Expressions.
2. [ ] [RTTI comment annotations](./3360-type-annotations.md) — JavaScript
   comments naming schemas, not inline TypeScript syntax.
3. [ ] [type inference](./3370-type-inference.md)
4. [ ] [promise](./3380-promise.md). Needed for JavaScript interop only —
   I/O is done with effects and requires no promises
   ([io-effects](./io-effects.md)).
5. [ ] [class](./3390-class.md)
6. [ ] [arity and complete arguments](./arity-complete-arguments.md) — an
   alternative for arbitrary length/full-argument construction, including
   the `withLength` pattern; not a prerequisite for named and rest parameters.

### 3.4. Syntactic Sugar

1. [ ] [assignments](./3430-assignments.md)
2. [ ] [template-literals](./3440-template-literals.md)
3. [ ] `async`/`await`. Depends on the implementation of promises.

### 3.5. Priority 4

1. [ ] [shadowing](./3150-shadowing.md) — a nested function must not reuse a
   name an enclosing scope binds; a warning or an error, undecided.
2. [ ] [export lists](./export-lists.md) — investigate options for `export { ... }`.

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

## Design documents

Design decisions and sketches for the unimplemented parts of the system. The
numbered ones moved here from the main spec README and keep their old section
numbers:

|Document|Topic|
|--------|-----|
|[io-effects](./io-effects.md)|§5 — I/O with effects: `Effect`, operations, runners|
|[content-addressable-vm](./content-addressable-vm.md)|§6 — content-addressable VM, hashing|
|[object-identity](./object-identity.md)|§7 — object identity, custom dictionaries, `Map`|
|[mutability](./mutability.md)|§8 — mutable objects and ownership tracking|
|[serialization](./serialization.md)|§9 — EDAG as data, CBOR, bytecode as VM-internal|
|[vm-command-format](./vm-command-format.md)|NPN command format of the VM|
|[design-principles](./design-principles.md)|design principles of the "ideal" FS 0.*|
|[function-frame](./3111-function-frame.md)|NaNVM function objects: frames and captured values, VM-internal|
|[call-like-instructions](./9100-call-like-instructions.md)|VM-internal bytecode for calls|
