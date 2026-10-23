## Refused Constructs

**Priority:** P2
**Status:** open

The language is a whitelist: a JavaScript construct is accepted only as part of
a recognized pattern, and every other is a compilation error
([principles](../principles/README.md)). So what the compiler refuses is part
of the language as much as what it accepts, and a refusal is held to the same
standard as an accepted form: a proof pins it, with where and why it fails, so
that admitting a construct by accident, or moving its error, fails a proof.

This register lists the valid JavaScript the compiler refuses, and why. It is
the place to look when a program is refused and the question is whether that
was meant, and the worklist for pinning each refusal in a proof
([pin-refused-constructs](../../fjs/compiler/todo/pin-refused-constructs.md)).

### Reading the register

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
  The [undecided constructs](../undecided/README.md) page lists these rows,
  with what the compiler prints for each.

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

### Source text

| ID | Construct | Why |
|---|---|---|
| `lex.trivia` | VT, FF, U+FEFF (a leading byte order mark included), NBSP and the other space separators such as U+3000; U+2028 or U+2029 outside a string | open (the [roadmap](./README.md) asks that each be recognized or its refusal justified; [whitespace](../lexical/whitespace/README.md)) |
| `lex.hashbang` | `#!` at the start of the file | planned ([hash comments](../../fjs/compiler/todo/083-compiler-hash-comments.md)) |
| `lex.unicode-name` | `const é = 1`, `{ π: 1 }`, `o.é`, U+200C or U+200D in a name, `const \u0061 = 1` | planned ([roadmap](./README.md), names beyond ASCII; [identifiers](../lexical/identifiers/README.md)) |

### Operators and expressions

| ID | Construct | Why |
|---|---|---|
| `op.loose-equality` | `a == b`, `a != b` | design ([operators](../operators/README.md); page: [`==` Is Refused](../operators/loose-equality/README.md)) |
| `op.in` | `"a" in o` | design ([in](./2346-in-operator.md); page: [`in` Is Refused](../operators/in/README.md)) |
| `op.instanceof` | `[] instanceof Map` | design ([`instanceof`](../operators/instanceof/README.md); page: [`instanceof` Other Than `Array` Is Refused](../operators/instanceof/other-classes/README.md)) |
| `op.comma` | `return a, b`, `throw a, b`, `if (a, b)`, `${a, b}`, `o[a, b]` — a comma JavaScript reads with no parentheses of its own | open ([comma](../operators/comma/README.md) admits it in parentheses, `return (a, b)`; no record plans the bare spellings) |
| `op.compound-assignment` | `a += 1`, `a **= 2`, `a &&= 2` | planned ([assignments](./3430-assignments.md)) |
| `op.update` | `++a`, `a--` | planned ([assignments](./3430-assignments.md)) |
| `op.delete` | `delete a.b` | open |
| `op.void` | `void 0` | open |
| `op.new` | `new Map()` | planned ([mutability](../design/mutability.md), [object identity](../design/object-identity.md)) |
| `op.this` | `this` | design ([design principles](../design/design-principles.md); page: [`this` Is Refused](../operators/this/README.md)) |
| `op.arguments` | `arguments` | open |
| `op.eval` | `eval("1")` | design ([built-ins](./2360-built-in.md): never admitted, it runs source at run time; page: [`eval` Is Refused](../built-ins/eval/README.md)) |
| `op.conversion-call-shape` | `Number(1, 2)`, `Number(...a)`, `String(1, 2)`, `String(...[])` | design ([operators and functions](../principles/README.md#operators-and-functions): a conversion is an operator, with a fixed set of operands; page: [A Conversion With Other Than One Operand Is Refused](../conversions/operands/README.md)) |
| `op.guarded-conversion` | `Number?.(x)`, `String?.(x)` | design ([operators and functions](../principles/README.md#operators-and-functions): an operator is no value, so it has no nullishness to guard; page: [A Guarded Conversion Is Refused](../conversions/guarded/README.md)) |
| `op.unary-plus` | `+1`, `+a` | open ([operators](../operators/README.md) leaves unary `+` out of the language; no record plans it) |
| `op.import-call` | `import("m")` | open |
| `op.import-meta` | `import.meta` | open |
| `op.regex` | `/a/g` | planned (roadmap, regular expressions) |
| `op.tagged-template` | ``tag`x` `` | open |

### Property access and names

| ID | Construct | Why |
|---|---|---|
| `acc.runtime-key` | `a[i]` | design ([property accessor](./2330-property-accessor.md); page: [A Key Computed at Run Time Is Refused](../property-access/runtime-keys/README.md)) |
| `acc.prototype-name` | `a.toString`, `a["push"]` | design ([property accessor](./2330-property-accessor.md); page: [A Prototype's Name Is Refused](../property-access/prototype-names/README.md)) |
| `acc.mutating-call` | `a.push(0)` | planned ([mutability](../design/mutability.md), "Local mutability") |
| `acc.prototype-call` | `a.hasOwnProperty(k)` | design ([built-ins](./2360-built-in.md); page: [A Prototype's Method Is Refused](../property-access/prototype-calls/README.md)) |
| `acc.guarded-namespace` | `Object?.is`, `Number?.["isInteger"]` | design ([built-in static functions](../built-ins/static-functions/README.md): a namespace is no value, so it has no nullishness to guard; page: [A Guarded Namespace Is Refused](../built-ins/static-functions/guarded/README.md)) |
| `acc.proto-key` | `{ __proto__: 1 }` | design ([`__proto__`](../values/objects/README.md#the-__proto__-key); page: [A `__proto__:` Key Is Refused](../values/objects/proto-key/README.md)) |
| `acc.property-assignment` | `a.b = 1` | open (related: [mutability](../design/mutability.md)) |
| `acc.numeric-key` | `{ 0: 1 }` | planned (roadmap, property key as number) |
| `name.literal-word` | `const NaN = 1`, `const undefined = 1`, `const Infinity = 1` | design ([literal words](./2445-literal-words-as-references.md); page: [Binding a Literal Word Is Refused](../bindings/literal-words/README.md)) |
| `name.intrinsic` | `const String = 1`, `export default String`, `export default Object` | design ([built-ins](./2360-built-in.md); [global names](./2365-global-names.md) reserves `Array`, `Number`, `Object` and `String` with no standalone value; page: [Binding a Built-in's Name Is Refused](../bindings/intrinsic-names/README.md)) |
| `name.unbound` | `zzz`, `Math`, `JSON`, `globalThis`, `Promise` | design; a bare global stays refused after [global names](./2365-global-names.md), which only improves the diagnostic (page: [A Global Is Refused](../bindings/globals/README.md)) |
| `name.forward-reference` | `export const a = b; export const b = 1;` | open ([forward references](./3140-forward-references.md) resolves only the object grouping and keeps refusing a later `const`) |
| `name.body-forward-reference` | `() => { const y = x; const x = 2; return y; }` with an outer `x` | planned ([body const forward reference](../../fjs/compiler/parser/todo/body-const-forward-reference.md)) |
| `name.reserved-export` | `export const then = 1` | design ([exporting a value](../modules/exports/README.md); page: [Exporting `then` Is Refused](../modules/exports/then/README.md)) |

### Statements

| ID | Construct | Why |
|---|---|---|
| `st.loop-variables` | a `while` whose block assigns no variable declared outside it, `while (r < n) { }`, or a second, `while (r < n) { r = r + 1; s = s + 1; }`; a loop at module level | planned ([let](./3220-let.md), "General loops"; the one-variable form is [loops](../control-flow/loops/README.md)) |
| `st.guard` | `else`, an unbraced `if`, a guard block that does not terminate (in `return`, `throw`, or a switch with a `default`), a guard at module level | planned ([functions](../functions/README.md): follow-ups, each additive) |
| `st.for` | `for (;;) { }` | planned ([let](./3220-let.md), "Later") |
| `st.for-in-of` | `for (k in o)`, `for (x of a)` | open |
| `st.do-while` | `do { } while (c)` | open |
| `st.break-continue` | `break`, `continue` | planned ([let](./3220-let.md) and [switch](./3230-switch.md), "Later") |
| `st.switch` | a case without braces, a case block that does not terminate (in `return`, `throw`, or a switch with a `default`), `break` in a case, a label stacked with the `default`, a switch with no case or of a `default` alone, a switch at module level or in a loop's block | planned ([switch](./3230-switch.md), "Later": follow-ups, each additive on the one form [switch](../control-flow/switch/README.md) has) |
| `st.switch-default` | a `default` that is not last | design ([switch](../control-flow/switch/README.md): last is the one spelling, the position saying nothing once every branch terminates; page: [A `default` Before a `case` Is Refused](../control-flow/switch/default-position/README.md)) |
| `st.try` | `try`, `catch`, `finally` | open |
| `st.debugger` | `debugger` | open |
| `st.label` | `x: while (c) { }` | open |
| `st.var` | `var a = 1` | design ([constants](../bindings/constants/README.md): `var` is not admitted; [variables](../bindings/variables/README.md) give `let` its block and no hoisting; page: [`var` Is Refused](../bindings/var/README.md)) |
| `st.empty` | `;;`, a stray `;` | design ([module structure](../modules/README.md); page: [An Empty Statement Is Refused](../modules/empty-statements/README.md)) |
| `st.expression` | an expression statement that is no call statement, no assignment to a variable and no directive (`st.directive`): one whose value is no call, `x;`, `a.b;`, `f(x).y;`, `Number(x);`, or that opens with `(`, `[` or a backtick, `(0, f)(x);`, `[a].at(0);`, `` `a`.trim(); `` | design ([call statements](../functions/call-statements/README.md): an operator's result discarded is almost always a mistake, a conversion is an operator, and a statement opening with `(`, `[` or a backtick would continue the one before it; page: [An Expression Statement That Is No Call Is Refused](../functions/call-statements/expression-statements/README.md)) |
| `st.directive` | `"use strict";`, a directive, which a module, strict already, makes nothing of | open ([call statements](../functions/call-statements/README.md) leave it refused, as before; no record decides whether to admit it as the nothing it is) |
| `st.literal-call` | a call statement opening with a literal, `"a".trim();`, `1 .toFixed(2);` | open ([call statements](../functions/call-statements/README.md) begin with a name; a literal continues no statement before it, so no hazard refuses it, and no record admits it) |
| `st.body-end` | a body that does not terminate — in `return`, `throw`, or a switch with a `default` ([switch](../control-flow/switch/README.md)) — `{}` | design ([functions](../functions/README.md); page: [A Body That Does Not Terminate Is Refused](../functions/body-end/README.md)) |
| `st.unreachable` | a statement after `return`, `throw`, or a switch with a `default` | design ([functions](../functions/README.md); page: [A Statement After `return` Is Refused](../functions/unreachable/README.md)) |

### Declarations and members

| ID | Construct | Why |
|---|---|---|
| `decl.class` | `class A {}` | planned ([class](./3390-class.md)) |
| `decl.function` | `function f() {}`, `function () {}` | open |
| `decl.async` | `async () => 1`, `async function f() {}` | planned ([promise](./3380-promise.md)) |
| `decl.generator` | `function* g() {}` | open |
| `decl.accessor` | `{ get a() { return 1 } }`, `{ set a(v) {} }` | open |
| `decl.method` | `{ f() { return 1 } }` | open |
| `decl.pattern-array-rest` | `[a, ...r]` in a pattern or a parameter | planned ([destructuring](./2450-destructuring.md), the next task) |
| `decl.pattern-object-rest` | `{ a, ...r }` in a pattern or a parameter | open ([destructuring](./2450-destructuring.md) files it as a follow-up) |
| `decl.let-uninitialized` | `let x;` | planned ([definite assignment](./3225-definite-assignment.md), P5: admitted where every path assigns the variable before a read; refused by design until then — [variables](../bindings/variables/README.md): a variable names its value where it is declared, as a body ends in an explicit `return`, and no path is tracked to a first assignment) |
| `decl.pattern-default` | `{ a = 1 }`, `[a = 1]` in a pattern | planned ([default parameters](./3125-default-parameters.md)) |
| `decl.pattern-computed-key` | `{ [k]: a }`, `{ [Number(i)]: a }`, `{ [(3)]: a }` | open ([destructuring](./2450-destructuring.md)) |
| `decl.parameter-limit` | 17 fixed parameters | design ([functions](../functions/README.md); page: [More Than 16 Fixed Parameters Are Refused](../functions/parameters/limit/README.md)) |

### Module structure

| ID | Construct | Why |
|---|---|---|
| `mod.no-export` | an empty module, `const a = 1;` alone | design ([module structure](../modules/README.md); page: [A Module With No Export Is Refused](../modules/no-export/README.md)) |
| `mod.empty-pattern-export` | `export const {} = {};` | design ([module structure](../modules/README.md): at least one export, and a pattern exports each name it binds; page: [An Export That Binds Nothing Is Refused](../modules/empty-pattern-export/README.md)) |
| `mod.export-after-default` | `export default 1; export const a = 2;` | design ([module structure](../modules/README.md); page: [An Export After `export default` Is Refused](../modules/export-after-default/README.md)) |
| `mod.import-after-export` | `export const a = 1; import b from "m";` | design ([module structure](../modules/README.md); page: [An Import After an Export Is Refused](../modules/import-after-export/README.md)) |
| `mod.throw-position` | `throw 1; export default 2;`, `export default 2; throw 1;` | design ([module structure](../modules/README.md); page: [A `throw` Beside an Export Is Refused](../modules/throw-position/README.md)) |
| `mod.export-list` | `const a = 1; export { a };` | open (investigated in [export lists](./export-lists.md)) |
| `mod.export-let` | `export let a = 1;` | design (an export is a `const`, [variables](../bindings/variables/README.md) being a body's; page: [`export let` Is Refused](../modules/export-let/README.md)) |
| `mod.reexport` | `export { a } from "m"`, `export * from "m"` | open (whether it belongs is a question in [export lists](./export-lists.md)) |
| `mod.side-effect-import` | `import "./d";` | open ([named imports](../named-imports.md) leaves it unsupported; no record plans it) |
| `mod.string-import-name` | `import { "x" as y } from "./d";` | open ([named imports](../named-imports.md) leaves it unsupported; no record plans it) |
| `mod.import-attribute-spelling` | `with { "type": "json" }`, `with { type: "json", }`, `with {}` | planned ([roadmap](./README.md), import attribute spellings) |
| `mod.namespace-import` | `import * as ns from "m"` | planned ([namespace import](./2220-namespace-import.md)) |
| `mod.top-level-await` | `await 1;` | open (related: [promise](./3380-promise.md)) |

### Literals

| ID | Construct | Why |
|---|---|---|
| `lit.octal` | `0o7` | open ([numbers](../values/numbers/README.md) leaves it out; the [roadmap](./README.md) records no use case yet) |
| `lit.leading-dot` | `.5` | planned (with the optional-chain-before-digit work, [roadmap](./README.md)) |
| `lit.trailing-dot` | `5.` | open |
| `lit.array-hole` | `[,]`, `[1,,2]` | design ([arrays](../values/arrays/README.md): an array has no holes; the same comma in a pattern is an elision, [destructuring](../bindings/destructuring/README.md); page: [An Array Hole Is Refused](../values/arrays/holes/README.md)) |
| `lit.double-quoted-apostrophe` | `"\'"` | design ([strings](../values/strings/README.md): a double-quoted string stays a JSON string; page: [`\'` in a Double-Quoted String Is Refused](../values/strings/apostrophe-escape/README.md)) |
| `lit.string-escape` | `"\x41"`, `"\v"`, `"\0"`, `"\u{41}"`, a raw TAB | open ([string literals](./2460-js-string-literals.md) defers them until a measured need appears) |
| `lit.string-continuation` | a `\` before a line terminator in a string | open ([string literals](./2460-js-string-literals.md) defers it until a measured need appears) |
| `lit.template-escape` | `` `\x41` ``, `` `\v` ``, a raw TAB in a template | open ([template literals](../values/template-literals/README.md) calls them deferred; no roadmap item admits them) |

### Not on this register

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
  ([command line](../command-line/README.md)).
- Limits the compiler enforces by size rather than by construct, other than
  the 16 fixed parameters above.
- The `.f.js` extension's own checks, which are about files, not syntax.
