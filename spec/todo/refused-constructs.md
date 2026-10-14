# Refused Constructs

**Priority:** P2
**Status:** open

The language is a whitelist: a JavaScript construct is accepted only as part of
a recognized pattern, and every other is a compilation error
([principles](../README.md#principles)). So what the compiler refuses is part
of the language as much as what it accepts, and a refusal is held to the same
standard as an accepted form: a proof pins it, with where and why it fails, so
that admitting a construct by accident, or moving its error, fails a proof.

This register lists the valid JavaScript the compiler refuses, why, what it
reports, and whether a proof pins it. It is the worklist for pinning the rest
([pin-refused-constructs](../../fjs/compiler/todo/pin-refused-constructs.md)),
and the place to look when a program is refused and the question is whether
that was meant.

## Reading the register

**Scope.** A row is a construct that is valid JavaScript module syntax and
that FunctionalScript refuses. JavaScript's own syntax errors (`1 +;`, a
missing brace) are not here: no conforming engine accepts them either. A
construct that is not listed is not thereby accepted; it is uncatalogued, and
gets a row when found.

**Why** says whether the refusal is meant to last:

- **design**: permanent. A record or the specification states the reason, and
  the row links it.
- **planned**: a record or the roadmap will admit the construct. The refusal
  ends when that lands.
- **open**: nothing in the specification mentions it. The whitelist alone
  refuses it, and a decision on whether it is permanent is owed.

**Diagnostic** is the compiler's message for the example, and *where* it is
reported. `unexpected token` is the grammar finding no rule for the token, at
that token; a named message (`reserved word`, `const not found`,
`duplicate id`, `prohibited property name`, …) comes from the step after the
grammar, which has understood the construct and refused its meaning. The
column of the example is part of the pin and is not repeated here.

**Pin** says whether a proof asserts the refusal, and in which file:

- **exact**: the proof asserts where and why: the message and position, or the
  token the grammar fails at.
- **loose**: the proof asserts only that the module is an error. Moving the
  error, or refusing it for another reason, goes unnoticed.
- **none**: no proof was found.

A pin is found by searching the compiler's and tokenizer's proofs for a
refusal naming the construct, and a search proves nothing about absence. A
**none** is a lead to confirm, a **loose** or **exact** names the proof that
was read. The survey ran at `b714c66b1`; the examples were compiled as the
`default` export of a one-line module and the first error read back.

**Keeping it true.** A row changes in the pull request that changes what it
describes:

- A pull request that pins a refusal sets its **Pin** and names the proof.
- A pull request that admits a construct deletes its row. The accepted form is
  pinned by the feature's own proofs and described in the specification; the
  register lists only what is refused.
- A pull request that makes a **planned** or **open** refusal permanent sets
  its **Why** to **design** and links the record.

## Operators and expressions

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `op.loose-equality` | `a == b`, `a != b` | design ([operators](./2340-operators.md)) | unexpected token | exact: parser `operators.proof`, `refusedByDesign` |
| `op.in` | `"a" in o` | design ([in](./2346-in-operator.md)) | unexpected token | exact: parser `operators.proof`, `refusedByDesign` |
| `op.instanceof` | `x instanceof Map` | design ([`instanceof`](../README.md#instanceof)) | the right operand of instanceof must be Array | exact: parser `operators.proof` |
| `op.comma` | `(1, 2)` | planned ([operators](./2340-operators.md)) | unexpected token | exact: parser `grammar/proof` |
| `op.assignment` | `a = 1` outside a loop's block | planned ([assignments](./3430-assignments.md)) | unexpected token | exact: parser `grammar/proof` |
| `op.compound-assignment` | `a += 1`, `a **= 2`, `a &&= 2` | planned ([assignments](./3430-assignments.md)) | unexpected token | none |
| `op.update` | `++a`, `a--` | planned ([assignments](./3430-assignments.md)) | unexpected token | none |
| `op.delete` | `delete a.b` | open | unexpected token | none |
| `op.void` | `void 0` | open | unexpected token | none |
| `op.new` | `new Map()` | open | unexpected token | none |
| `op.this` | `this` | design ([design principles](./design-principles.md)) | reserved word | none |
| `op.super` | `super.x` | open | reserved word | none |
| `op.arguments` | `arguments` | open | reserved word | none |
| `op.eval` | `eval("1")` | open | reserved word | none |
| `op.await` | `await a` | planned ([promise](./3380-promise.md)) | unexpected token | none |
| `op.yield` | `yield a` | open | unexpected token | none |
| `op.import-call` | `import("m")` | open | reserved word | none |
| `op.import-meta` | `import.meta` | open | reserved word | none |
| `op.regex` | `/a/g` | planned (roadmap, regular expressions) | unexpected token | none |
| `op.tagged-template` | ``tag`x` `` | open | unexpected token | exact: parser `grammar/proof` |

## Property access and names

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `acc.runtime-key` | `a[i]` | design ([property accessor](./2330-property-accessor.md)) | computed key is not Number(...) | exact: `language.proof` |
| `acc.prototype-name` | `a.toString`, `a["push"]` | design ([property accessor](./2330-property-accessor.md)) | prohibited property name | exact: `language.proof` |
| `acc.prototype-call` | `a.push(0)`, `a.hasOwnProperty(k)` | design ([built-ins](./2360-built-in.md)) | prohibited member function | exact: compiler `proof` |
| `acc.proto-key` | `{ __proto__: 1 }` | design ([`__proto__`](../README.md#the-__proto__-key)) | `__proto__` requires the computed key form | exact: parser `proof` |
| `acc.property-assignment` | `a.b = 1` | planned ([assignments](./3430-assignments.md)) | unexpected token | exact: parser `grammar/proof` (in a loop's block) |
| `acc.numeric-key` | `{ 0: 1 }` | planned (roadmap, property key as number) | unexpected token | none |
| `name.keyword` | `const if = 1`, `const in = 1`, `export const default = 1` | design | reserved word | exact: parser `proof`, `operators.proof` |
| `name.literal-word` | `const NaN = 1`, `const undefined = 1`, `const Infinity = 1` | design ([literal words](./2445-literal-words-as-references.md)) | reserved word | exact: parser `proof` |
| `name.intrinsic` | `const String = 1`, `export default String` | design ([built-ins](./2360-built-in.md)) | reserved word | exact: `language.proof` |
| `name.unbound` | `zzz`, `Math`, `JSON`, `Object`, `globalThis`, `Promise` | design for an unbound name; planned for the globals ([global names](./2365-global-names.md)) | const not found | exact for an unbound name; none for a global by name |
| `name.forward-reference` | `export const a = b; export const b = 1;` | planned ([forward references](./3140-forward-references.md)) | const not found | exact for `const a = a`; loose for a later `const` |
| `name.duplicate` | `const a = 1; const a = 2;`, a duplicate import, an import and a `const` of one name | design | duplicate id | exact: parser `proof` |
| `name.duplicate-parameter` | `(a, a) => a`, a body `const` named as a parameter | design | duplicate id | none |
| `name.reserved-export` | `export const then = 1` | design | reserved export name then | exact: parser `proof` |

## Statements

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `st.let-while` | a `let` or `while` outside the one-variable loop, or its block holding more than the rebinding | planned ([let](./3220-let.md)) | let without while, while without let, not the loop variable, … | exact: parser `proof`, `grammar/proof` |
| `st.else` | `else`, an unbraced `if` | planned ([functions](../README.md#functions)) | unexpected token | exact: parser `grammar/proof` |
| `st.for` | `for`, `for...of`, `for...in` | planned ([let](./3220-let.md)) | unexpected token | `for...in` exact: parser `operators.proof`; the rest none |
| `st.do-while` | `do { } while (c)` | planned ([let](./3220-let.md)) | unexpected token | none |
| `st.break-continue` | `break`, `continue` | planned ([let](./3220-let.md)) | unexpected token | none |
| `st.switch` | `switch` | open | unexpected token | none |
| `st.try` | `try`, `catch`, `finally` | open | unexpected token | none |
| `st.with` | `with` | open | unexpected token | none |
| `st.debugger` | `debugger` | open | unexpected token | none |
| `st.label` | `x: while (c) { }` | open | unexpected token | none |
| `st.var` | `var a = 1` | design ([`let`](../README.md#loops), [let](./3220-let.md): `var` not at all) | unexpected token | none |
| `st.empty` | `;;`, a stray `;` | design ([module structure](../README.md#module-structure)) | unexpected token | exact: parser `proof` |
| `st.expression` | a body statement that is no `const`, `if`, `throw` or `return` | design ([functions](../README.md#functions)) | unexpected token | exact: parser `grammar/proof` |
| `st.body-end` | a body that does not end in `return` or `throw`, `{}` | design ([functions](../README.md#functions)) | unexpected token | exact: parser `grammar/proof` |
| `st.unreachable` | a statement after `return` or `throw` | design ([functions](../README.md#functions)) | unexpected token | exact: parser `grammar/proof` |

## Declarations and members

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `decl.class` | `class A {}` | planned ([class](./3390-class.md)) | unexpected token | none |
| `decl.function` | `function f() {}`, `function () {}` | open | unexpected token | none |
| `decl.async` | `async () => 1`, `async function f() {}` | planned ([promise](./3380-promise.md)) | unexpected token | none |
| `decl.generator` | `function* g() {}` | open | unexpected token | none |
| `decl.accessor` | `{ get a() { return 1 } }`, `{ set a(v) {} }` | open | unexpected token | none |
| `decl.method` | `{ f() { return 1 } }` | open | unexpected token | none |
| `decl.parameter-default` | `(a = 1) => a` | open ([parameters](./3120-parameters.md) mentions defaults only as a later possibility) | unexpected token | exact: parser `grammar/proof` |
| `decl.parameter-limit` | 17 fixed parameters | design ([functions](../README.md#functions)) | more than 16 fixed parameters | exact: parser `proof` |

## Module structure

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `mod.no-export` | an empty module, `const a = 1;` alone | design ([module structure](../README.md#module-structure)) | unexpected end | exact: parser `proof` |
| `mod.second-default` | `export default 1; export default 2;` | design | unexpected token | loose: parser `proof`, `errors` |
| `mod.export-after-default` | `export default 1; export const a = 2;` | design | unexpected token | loose: parser `proof`, `errors` |
| `mod.import-after-export` | `export const a = 1; import b from "m";` | design | unexpected token | exact: parser `grammar/proof` |
| `mod.throw-position` | `throw 1; export default 2;`, `export default 2; throw 1;` | design ([module structure](../README.md#module-structure)) | unexpected token | exact: parser `proof` |
| `mod.export-list` | `export { a };` | planned ([export lists](./export-lists.md)) | unexpected token | loose: parser `proof`, `errors` |
| `mod.export-let` | `export let a = 1;` | design (`let` only opens a loop, [let](./3220-let.md)) | unexpected token | loose: parser `proof`, `errors` |
| `mod.reexport` | `export { a } from "m"`, `export * from "m"` | planned ([export lists](./export-lists.md), [namespace import](./2220-namespace-import.md)) | unexpected token | none |
| `mod.namespace-import` | `import * as ns from "m"` | planned ([namespace import](./2220-namespace-import.md)) | unexpected token | none |
| `mod.top-level-await` | `await 1;` | planned ([promise](./3380-promise.md)) | unexpected token | none |
| `mod.top-level-return` | `return 1;` | design | unexpected token | none |

## Literals

| ID | Construct | Why | Diagnostic | Pin |
|---|---|---|---|---|
| `lit.octal` | `0o7`, `010`, `08` | design ([numbers](../README.md#numbers)) | unexpected token | none for the compiler; the DataJS reject vectors pin `0o10` for the DataJS reader |
| `lit.decimal-form` | `.5`, `5.` | open | unexpected token | none |
| `lit.array-hole` | `[,]`, `[1,,2]` | open | unexpected token | exact: parser `proof` |
| `lit.string-escape` | `"\x41"`, `"\v"`, `"\0"`, `"\u{41}"`, a raw TAB | planned ([string literals](./2460-js-string-literals.md)) | unexpected token | none |
| `lit.string-continuation` | a `\` before a line terminator in a string | planned ([string literals](./2460-js-string-literals.md)) | unexpected token | none |
| `lit.template-escape` | `` `\x41` ``, `` `\v` ``, a raw TAB in a template | planned ([template literals](../README.md#template-literals)) | unexpected token | exact: compiler `tokenizer/proof`, `refusedEscapes` |

## Not on this register

- Refusals of the other outputs, such as the `.json` output refusing
  `undefined` or the Rust output refusing a function it cannot name. They
  refuse a value the language accepts, and are specified with the outputs
  ([command line](../README.md#command-line)).
- Limits the compiler enforces by size rather than by construct, other than
  the 16 fixed parameters above.
- The `.f.js` extension's own checks, which are about files, not syntax.
