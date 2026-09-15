## Two access nodes: `.` for a known name, `entry` for an object's entry at run time

**Priority:** P2
**Status:** open — the alternative to [`own-access.md`](./own-access.md)

### Problem

[`own-access.md`](./own-access.md) folds `own` into `.` and makes every
access an own read, and that decision drags a second one behind it: once
`name` is readable through an own read, a function's `name` has to mean
something, so [`function-name.md`](./function-name.md) gives `=>` a name
operand, the graph stops being name-erased, and the writer grows a pattern
to restore names it would rather not know. The cost is out of proportion to
the value, which is `person.name` on a plain object.

A static rule cannot separate `f.name` from `person.name`, since it sees the
key and not the base. A guard on the base's type can, and was weighed: it
throws on a function, but also on a string, and a guard narrowed to
functions and `name` is a special case bolted onto a general read. The
criterion that separates the two without looking at the base is
enumerability: `person.name` is an enumerable own property, `f.name` is
not, and neither is `length` on anything.

### Proposal

An object's data is its enumerable own properties — exactly what
`Object.entries` lists — and the run-time read is a read of one entry. Keep
two operators, each with one job.

- **`['.', a, key]` — a known name.** The key is a literal or a constant the
  compiler resolves, so every check is static: the prohibited names refused
  at the key, `name` among them, `length` allowed. `a.b`, `a["b"]`, `a[0]`
  and `a[Number(k)]` are its spellings. The executor reads it as an own
  property, `undefined` where there is none, as the value path does
  through `hasOwn` and as [`own-access.md`](./own-access.md) defines — that
  part of it stands; what this proposal changes is the run-time read and
  `name`. The writer's `a.b` agrees with that read under the assumption
  every FunctionalScript file run by a JavaScript engine already relies on,
  a realm whose prototypes are the standard's, since every standard
  prototype name is refused at the key. `f.name` and `person.name` are both
  refused here; the second has the other spelling.
- **`['entry', a, b]` — an entry, at run time.** Both operands are
  expressions, and the node is the value of `a`'s entry `b`, or `undefined`
  if `a` has no such entry:

  | read | result |
  |-|-|
  | `entry(person, "name")`, `entry([1], "0")`, `entry("abc", "0")` | the value — an enumerable own property, a string's characters included, as `Object.entries` lists them |
  | `entry(f, "name")`, `entry(f, "length")`, `entry([1], "length")` | `undefined` — own but not enumerable, so not an entry |
  | `entry(5, "x")`, `entry(f, "x")` | `undefined` — no such entry; a primitive boxes as in JavaScript |
  | `entry(null, b)`, `entry(undefined, b)` | throws, as JavaScript's read throws |

  The key is a string, a number, a bigint, a boolean or `undefined`,
  converted to a property key as JavaScript converts one, a string as is
  and the rest by `ToString`, so `0` reads `"0"` and `true` reads `"true"`.
  Any other key — `null`, an array, an object, a function — throws, and
  the pattern itself says so: its descriptor call takes `null` as the
  receiver when `typeof b` is `'object'` or `'function'`, which is the
  throw JavaScript performs on a nullish receiver, so JavaScript agrees on
  every key and there is no divergence to state. The class is refused
  whole because JavaScript would convert it through `ToPrimitive`, which
  calls a `toString` or `valueOf` the value carries and, for a function or
  an array holding one, reaches source text the name-erased graph does not
  carry, and the native VM has no path to call a function during a
  conversion. No guard on the base is needed: a function
  has no entries, so `entry` on one is `undefined` for every key, which is
  the right answer for "a function has no data", and nothing throws that
  JavaScript would not throw.
- **`['entry']` is the function, and the source form is its definition.**
  The node is nullary: its value is the function `(a, b) => …` with the
  semantics above and arity `2`, the first node whose value is a function
  the language defines rather than one the program builds. A developer
  defines the read once and calls it, so the pattern is the definition,
  recognized whole and lowered to the node:

  ```js
  const entry = (a, b) => {
      const x = Object.getOwnPropertyDescriptor(typeof b === 'object' || typeof b === 'function' ? null : a, b)
      return x?.enumerable ? x.value : undefined
  }
  // ['entry']
  entry(o, k)
  // ['()', E, ['[]', [o, k]]], E the node the `const` holds
  ```

  `a`, `b` and `x` are identifier placeholders, each the same identifier at
  every occurrence; `x?.enumerable` because a missing property has no
  descriptor. The pattern fixes the whole body, so the descriptor is
  declared and consumed inside it and never becomes a value of the
  language — `Object.getOwnPropertyDescriptor` exists nowhere but inside
  this pattern, and a function that does anything else with the
  descriptor, returns it, reads `writable`, is not the pattern and is
  refused. The parser matches the definition as a fixed token shape, as
  `["__proto__"]` is one token, so it needs none of named parameters, a
  block body, a body constant or `return` in general; a use site is an
  ordinary call, which is the one real dependency. The node mints identity
  as `=>` does — each evaluation is a function object, so two definitions
  in one program are two functions, as two `const` definitions are in
  JavaScript, and the analysis counts it as a constructor. It can stand
  anywhere a value can, `[entry, entry]`, an argument, an export, and the
  writer spells it as the pattern's text wherever it stands, hoisted when
  shared, so it round-trips from any position; the executor maps it to one
  host function of arity `2`, and `entry.length` is `2` by definition.
  JavaScript reads the definition as the function it is, so the text means
  the same in both.
- **The technique is general, and `entry` is its first instance.** A
  built-in the program cannot name — a global object is a namespace, never
  a value — is delivered as a function the program defines, in three parts
  that are the same every time: the source form is a definition matched
  whole as a fixed token shape with identifier placeholders, so the parser
  needs none of the general features the definition uses and nothing
  inside the fixed body can leak; the node is nullary and its value is the
  function, arity by definition, identity like `=>`, standing anywhere a
  value can, every use an ordinary call, one host function in the executor
  and one operation in the native VM; and the built-in it wraps exists
  nowhere else, which makes the wrapped semantics the only semantics. The
  next such function — an existence test over the same descriptor read,
  once `2345` settles it, the `Number` cast, the string and array functions
  [`2360-built-in.md`](../../../spec/todo/2360-built-in.md) lists as
  allowed — is one pattern, one `op0` node and one row in the table, and no
  new rule.
- **`name` is unobservable.** `.` refuses it statically, and `entry` reads
  `undefined` because `name` is not an entry, so no FunctionalScript program
  reads a function's `name`. `=>` carries no name, the graph stays
  name-erased, the writer's `$0` is invisible, and `function-name.md`
  closes. `Object.entries`, `keys` and `values` list entries only, so they
  agree with JavaScript as they are — `Object.keys(f)` is `[]`,
  `Object.keys([1, 2])` is `['0', '1']`. The functions that see
  non-enumerable properties, `getOwnPropertyNames` and
  `getOwnPropertyDescriptors`, leave the allowed list or are redefined over
  entries. `Object.hasOwn` as it stands would reveal `name`'s existence
  where `entry` reads `undefined`, so if it is kept it follows the same
  enumerability rule; whether `{ a: undefined }` has an entry `a` is
  [`1010-undefined-property.md`](../../../spec/todo/1010-undefined-property.md)'s
  question and [`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)'s
  to settle, and this todo decides nothing about it.
- **`a[b]` with an unknown `b` stays refused.** It cannot lower to `entry`:
  JavaScript's `a[b]` walks the prototype chain and `entry` does not, and
  `b` may be `"constructor"` at run time. The `entry` function is the
  source form for a run-time key, and it means the same in both.
- **Both executors, one answer.** The native VM's `own` is pinned today by
  the conformance corpus in [`fjs/nanvm`](../../nanvm/module.f.mjs)
  (`ownCases`), which generates the Rust vectors and documents
  `Any::own_property` in `nanvm-lib`. Its answers for a primitive or a
  function receiver, `undefined`, already match `entry`; what changes is
  that an array and a string are receivers with their items as entries and
  `length` no longer read, and that a primitive key is converted by
  `ToString` rather than refused, which needs no call into user code. The
  corpus, the generated vectors, `Any::own_property` and
  its documentation change with amnesia, in the same PR, so the JavaScript
  and native executions keep agreeing on every listed input.
- **Unchanged.** The analysis merges `.` as a plain read, since it mints
  no identity, and a call of `entry` as any call; `?.` and `|.` stay
  control flow.

### Tasks

- [ ] `entry` replaces `own`: `['entry']` joins the `op0` ids as the function
      value, with the enumerable-own semantics; the README's table says which
      read each node is and why, and that this one's value is a function the
      language defines.
- [ ] Amnesia evaluates `['entry']` to one host function of arity `2` that
      reads the descriptor and its `enumerable` flag, with
      proofs for an object, an array, a string, `null`, a number and a
      function as the base; a number, a boolean and `undefined` as the key
      converting, and `null`, an array, an object and a function as the key
      throwing; a missing property; and `name` and `length` on a function
      reading `undefined`.
- [ ] The native VM follows in the same PR. It implements the function's
      semantics as its own two-operand operation, the successor of
      `Any::own_property`, and the conformance corpus in `fjs/nanvm` keeps
      pinning that operation as `ownCases` does today, `[op, a, b]`, since the
      Rust emitter has no call yet; the node's value as a callable in Rust
      waits on native calls. The answers change to the entry answers — an
      array and a string receivers with their items, `length` and `name`
      `undefined`, a primitive key converted by `ToString`, any other key a
      throw — and the key conversion is ECMAScript's `Number::toString`, the
      shortest round-trip spelling the DataJS specification already defines,
      not Rust's `f64::to_string`: `1e21` reads `"1e+21"`, `0.1` reads
      `"0.1"`, `-0` reads `"0"`, each pinned as a boundary case.
- [ ] The parser recognizes the `entry` function as a fixed token shape with
      identifier placeholders and lowers it to `['entry']`, refuses
      `Object.getOwnPropertyDescriptor` anywhere else, and keeps `name`
      prohibited for `.`; proofs for the definition, a call of it once calls
      land, `entry.length` reading `2`, two definitions being two functions, a
      function that returns the descriptor refused, and `f.name` refused
      through `.`; the writer spells the node as the pattern's text from any
      position.
- [ ] `own-access.md` and `function-name.md` closed in favor of this, and the
      references to them in `analysis.md`, `is-operator.md`,
      `functionalscript-output.md` and `interpret-edag.md` repointed.
- [ ] `2360-built-in.md` removes `getOwnPropertyNames` and
      `getOwnPropertyDescriptors` from the allowed list, or redefines them over
      entries, and marks `hasOwn` as following `2345`.
- [ ] The spec todos updated in the same migration:
      [`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
      spells `own_property` as the `entry` function, and
      [`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)
      takes `entry`'s enumerability rule in place of the `Object`-only scope
      it inherits from the current `own`, and keeps the `{ a: undefined }`
      question it defers to `1015`.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`own-access.md`](./own-access.md) — the one-node proposal this replaces.
- [`function-name.md`](./function-name.md) — the name operand this makes
  unnecessary.
- [`../amnesia/README.md`](../amnesia/README.md) — the `own` read this
  redefines as `entry`.
- [`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md) —
  `Object.getOwnPropertyDescriptor` and the reflection functions this
  constrains.
