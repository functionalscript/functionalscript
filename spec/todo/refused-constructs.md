# Refused Constructs

**Priority:** P2
**Status:** open

The language is a whitelist: a JavaScript construct is accepted only as part of
a recognized pattern, and every other is a compilation error
([principles](../README.md#principles)). So what the compiler refuses is part
of the language as much as what it accepts, and a refusal is held to the same
standard as an accepted form: a proof pins it, with where and why it fails, so
that admitting a construct by accident, or moving its error, fails a proof.

This register lists the valid JavaScript the compiler refuses, and why. It is
the place to look when a program is refused and the question is whether that
was meant, and the worklist for pinning each refusal in a proof
([pin-refused-constructs](../../fjs/compiler/todo/pin-refused-constructs.md)).

## Reading the register

**Scope.** A row is a construct that is valid in an ECMAScript module, in the
syntax and in the early errors, and that FunctionalScript refuses. JavaScript's
own errors are not here, since no conforming engine accepts them either: a
missing brace, a duplicate declaration, `with` or a legacy octal literal in
module code, `return` outside a function, a duplicate `export default`, a
binding named as a keyword ([below](#not-on-this-register)). A construct that
is not listed is not thereby accepted; it is uncatalogued, and gets a row when
found. In the examples, `a`, `i`, `k` and `o` stand for constants in scope, so
that the example is refused for the row's reason and not as an unbound name.

**Why** says whether the refusal is meant to last:

- **design**: permanent. A record or the specification states the reason, and
  the row links it.
- **planned**: a record or the roadmap proposes admitting the construct, and the
  row names it. The refusal ends when that lands. A record that only
  investigates whether to admit it is not a plan, and the row is **open**.
- **open**: no record or roadmap entry proposes admitting it, and none states
  that it stays out. The whitelist alone refuses it, and a decision on whether
  it is permanent is owed. A related record, where there is one, is named.

**What the register leaves to the proofs.** What the compiler reports for a
construct, and whether a proof pins it, change with the compiler, and a column
holding either here would expire with the next change. The proof that pins a
refusal holds both: it asserts the message and the position, and fails when
either moves. So a row records only what changes when a decision does.

**Keeping it true.** A row changes in the pull request that changes what it
describes:

- A pull request that admits a construct deletes its row. The accepted form is
  pinned by the feature's own proofs and described in the specification; the
  register lists only what is refused. A proof that pins a refusal names the
  row's ID beside it, so the change that admits the construct, which fails
  that proof, finds the row.
- A pull request that makes a **planned** or **open** refusal permanent sets
  its **Why** to **design** and links the record.

## Source text

| ID | Construct | Why |
|---|---|---|
| `lex.trivia` | VT, FF, U+FEFF (a leading byte order mark included), NBSP and the other space separators such as U+3000; U+2028 or U+2029 outside a string | open (the [roadmap](./README.md) asks that each be recognized or its refusal justified; [whitespace](../lexical/whitespace.md)) |
| `lex.hashbang` | `#!` at the start of the file | planned ([hash comments](../../fjs/compiler/todo/083-compiler-hash-comments.md)) |
| `lex.unicode-name` | `const é = 1`, `{ π: 1 }`, `o.é`, U+200C or U+200D in a name, `const \u0061 = 1` | planned ([roadmap](./README.md), names beyond ASCII; [identifiers](../lexical/identifiers.md)) |

## Operators and expressions

| ID | Construct | Why |
|---|---|---|
| `op.loose-equality` | `a == b`, `a != b` | design ([operators](./2340-operators.md)) |
| `op.in` | `"a" in o` | design ([in](./2346-in-operator.md)) |
| `op.instanceof` | `[] instanceof Map` | design ([`instanceof`](../README.md#instanceof)) |
| `op.comma` | `(1, 2)` | planned ([operators](./2340-operators.md)) |
| `op.assignment` | `a = 1` outside a loop's block | planned ([let](./3220-let.md), "Later": a `let` outside a loop is a rebinding) |
| `op.compound-assignment` | `a += 1`, `a **= 2`, `a &&= 2` | planned ([assignments](./3430-assignments.md)) |
| `op.update` | `++a`, `a--` | planned ([assignments](./3430-assignments.md)) |
| `op.delete` | `delete a.b` | open |
| `op.void` | `void 0` | open |
| `op.new` | `new Map()` | planned ([mutability](./mutability.md), [object identity](./object-identity.md)) |
| `op.this` | `this` | design ([design principles](./design-principles.md)) |
| `op.arguments` | `arguments` | open |
| `op.eval` | `eval("1")` | design ([built-ins](./2360-built-in.md): never admitted, it runs source at run time) |
| `op.number-spread` | `Number(...a)`, `Number(1, 2)` | planned ([number-spread](./2363-number-spread.md), roadmap) |
| `op.string-call-shape` | `String(1, 2)`, `String(...[1])`, `String(...[])` | open (the specification leaves them unrecognized; no record plans them) |
| `op.guarded-conversion` | `Number?.(x)`, `String?.(x)` | open ([number](../README.md#number-conversion) and [string](../README.md#string-conversion) conversion refuse the guard at the word; no record plans reading it away) |
| `op.unary-plus` | `+1`, `+a` | open ([operators](./2340-operators.md) leaves unary `+` on the other side of the line; no record plans it) |
| `op.import-call` | `import("m")` | open |
| `op.import-meta` | `import.meta` | open |
| `op.regex` | `/a/g` | planned (roadmap, regular expressions) |
| `op.tagged-template` | ``tag`x` `` | open |

## Property access and names

| ID | Construct | Why |
|---|---|---|
| `acc.runtime-key` | `a[i]` | design ([property accessor](./2330-property-accessor.md)) |
| `acc.prototype-name` | `a.toString`, `a["push"]` | design ([property accessor](./2330-property-accessor.md)) |
| `acc.mutating-call` | `a.push(0)` | planned ([mutability](./mutability.md), "Local mutability") |
| `acc.prototype-call` | `a.hasOwnProperty(k)` | design ([built-ins](./2360-built-in.md)) |
| `acc.proto-key` | `{ __proto__: 1 }` | design ([`__proto__`](../README.md#the-__proto__-key)) |
| `acc.property-assignment` | `a.b = 1` | open (related: [mutability](./mutability.md)) |
| `acc.numeric-key` | `{ 0: 1 }` | planned (roadmap, property key as number) |
| `name.literal-word` | `const NaN = 1`, `const undefined = 1`, `const Infinity = 1` | design ([literal words](./2445-literal-words-as-references.md)) |
| `name.intrinsic` | `const String = 1`, `export default String`, `export default Object` | design ([built-ins](./2360-built-in.md); [global names](./2365-global-names.md) reserves `Array`, `Number`, `Object` and `String` with no standalone value) |
| `name.unbound` | `zzz`, `Math`, `JSON`, `globalThis`, `Promise` | design; a bare global stays refused after [global names](./2365-global-names.md), which only improves the diagnostic |
| `name.forward-reference` | `export const a = b; export const b = 1;` | open ([forward references](./3140-forward-references.md) resolves only the object grouping and keeps refusing a later `const`) |
| `name.body-forward-reference` | `() => { const y = x; const x = 2; return y; }` with an outer `x` | planned ([body const forward reference](../../fjs/compiler/parser/todo/body-const-forward-reference.md)) |
| `name.reserved-export` | `export const then = 1` | design ([exporting a value](../README.md#exporting-a-value)) |

## Statements

| ID | Construct | Why |
|---|---|---|
| `st.let-while` | a `let` or `while` outside the one-variable loop, or its block holding a statement that is no `const` and no assignment to the loop variable | planned ([let](./3220-let.md)) |
| `st.guard` | `else`, an unbraced `if`, a guard block that does not end in `return` or `throw`, a guard at module level | planned ([functions](../README.md#functions): follow-ups, each additive) |
| `st.for` | `for (;;) { }` | planned ([let](./3220-let.md), "Later") |
| `st.for-in-of` | `for (k in o)`, `for (x of a)` | open |
| `st.do-while` | `do { } while (c)` | open |
| `st.break-continue` | `break`, `continue` | planned ([let](./3220-let.md), "Later") |
| `st.switch` | `switch` | open |
| `st.try` | `try`, `catch`, `finally` | open |
| `st.debugger` | `debugger` | open |
| `st.label` | `x: while (c) { }` | open |
| `st.var` | `var a = 1` | design ([constants](../README.md#shared-values-constants): `var` is not admitted; [let](./3220-let.md) adds only the loop variable) |
| `st.empty` | `;;`, a stray `;` | design ([module structure](../README.md#module-structure)) |
| `st.expression` | an expression statement (a body statement that is no `const`, `if`, `throw`, `return` or admitted `let`/`while` loop) | design ([functions](../README.md#functions)) |
| `st.body-end` | a body that does not end in `return` or `throw`, `{}` | design ([functions](../README.md#functions)) |
| `st.unreachable` | a statement after `return` or `throw` | design ([functions](../README.md#functions)) |

## Declarations and members

| ID | Construct | Why |
|---|---|---|
| `decl.class` | `class A {}` | planned ([class](./3390-class.md)) |
| `decl.function` | `function f() {}`, `function () {}` | open |
| `decl.async` | `async () => 1`, `async function f() {}` | planned ([promise](./3380-promise.md)) |
| `decl.generator` | `function* g() {}` | open |
| `decl.accessor` | `{ get a() { return 1 } }`, `{ set a(v) {} }` | open |
| `decl.method` | `{ f() { return 1 } }` | open |
| `decl.parameter-default` | `(a = 1) => a` | planned ([default parameters](./3125-default-parameters.md)) |
| `decl.pattern-array-rest` | `[a, ...r]` in a pattern or a parameter | planned ([destructuring](./2450-destructuring.md), the next task) |
| `decl.pattern-object-rest` | `{ a, ...r }` in a pattern or a parameter | open ([destructuring](./2450-destructuring.md) files it as a follow-up) |
| `decl.pattern-default` | `{ a = 1 }`, `[a = 1]` in a pattern | planned ([default parameters](./3125-default-parameters.md)) |
| `decl.pattern-computed-key` | `{ [k]: a }`, `{ [Number(i)]: a }`, `{ [(3)]: a }` | open ([destructuring](./2450-destructuring.md)) |
| `decl.pattern-elision` | `[, b]`, `[a, , b]` | planned ([destructuring](./2450-destructuring.md), the next task, with the array rest) |
| `decl.parameter-limit` | 17 fixed parameters | design ([functions](../README.md#functions)) |

## Module structure

| ID | Construct | Why |
|---|---|---|
| `mod.no-export` | an empty module, `const a = 1;` alone | design ([module structure](../README.md#module-structure)) |
| `mod.empty-pattern-export` | `export const {} = {};` | design ([module structure](../README.md#module-structure): at least one export, and a pattern exports each name it binds) |
| `mod.export-after-default` | `export default 1; export const a = 2;` | design ([module structure](../README.md#module-structure)) |
| `mod.import-after-export` | `export const a = 1; import b from "m";` | design ([module structure](../README.md#module-structure)) |
| `mod.throw-position` | `throw 1; export default 2;`, `export default 2; throw 1;` | design ([module structure](../README.md#module-structure)) |
| `mod.export-list` | `const a = 1; export { a };` | open (investigated in [export lists](./export-lists.md)) |
| `mod.export-let` | `export let a = 1;` | design (`let` only opens a loop, [let](./3220-let.md)) |
| `mod.reexport` | `export { a } from "m"`, `export * from "m"` | open (whether it belongs is a question in [export lists](./export-lists.md)) |
| `mod.side-effect-import` | `import "./d";` | open ([named imports](../named-imports.md) leaves it unsupported; no record plans it) |
| `mod.string-import-name` | `import { "x" as y } from "./d";` | open ([named imports](../named-imports.md) leaves it unsupported; no record plans it) |
| `mod.import-attribute-spelling` | `with { "type": "json" }`, `with { type: "json", }`, `with {}` | planned ([roadmap](./README.md), import attribute spellings) |
| `mod.namespace-import` | `import * as ns from "m"` | planned ([namespace import](./2220-namespace-import.md)) |
| `mod.top-level-await` | `await 1;` | open (related: [promise](./3380-promise.md)) |

## Literals

| ID | Construct | Why |
|---|---|---|
| `lit.octal` | `0o7` | open ([numbers](../README.md#numbers) leaves it out; the [roadmap](./README.md) records no use case yet) |
| `lit.leading-dot` | `.5` | planned (with the optional-chain-before-digit work, [roadmap](./README.md)) |
| `lit.trailing-dot` | `5.` | open |
| `lit.array-hole` | `[,]`, `[1,,2]` | open |
| `lit.double-quoted-apostrophe` | `"\'"` | design ([strings](../README.md#strings): a double-quoted string stays a JSON string) |
| `lit.string-escape` | `"\x41"`, `"\v"`, `"\0"`, `"\u{41}"`, a raw TAB | open ([string literals](./2460-js-string-literals.md) defers them until a measured need appears) |
| `lit.string-continuation` | a `\` before a line terminator in a string | open ([string literals](./2460-js-string-literals.md) defers it until a measured need appears) |
| `lit.template-escape` | `` `\x41` ``, `` `\v` ``, a raw TAB in a template | open ([template literals](../README.md#template-literals) calls them deferred; no roadmap item admits them) |

## Not on this register

- JavaScript's own errors, which the compiler also diagnoses. They are
  refusals of broken JavaScript and not of FunctionalScript: a duplicate
  `const`, import or parameter name (`duplicate id`); a binding named as a
  keyword (`const if = 1`, `const in = 1`, `export const default = 1`);
  `with`, a legacy octal literal such as `010` or `08`, `return` outside a
  function, `super` outside a method, and `await` or `yield` where they are
  reserved; a second `export default`. A proof for one is welcome, and the
  parser's module refusal table already holds several, but pinning them is not
  the register's work.
- Refusals of the other outputs, such as the `.json` output refusing
  `undefined` or the Rust output refusing a function it cannot name. They
  refuse a value the language accepts, and are specified with the outputs
  ([command line](../README.md#command-line)).
- Limits the compiler enforces by size rather than by construct, other than
  the 16 fixed parameters above.
- The `.f.js` extension's own checks, which are about files, not syntax.
