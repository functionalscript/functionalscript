## Two access nodes: `.` for a known name, `own` for an object's own name

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
key and not the base, and the base's type is known only at run time. A
guard on one shared node can, but a guard that sends every non-object to
`null` also throws on `"abc".length`, and a guard narrowed to functions and
`name` is a special case bolted onto a general read.

### Proposal

Keep two operators, each with one job, and read the guard as what the
built-in already says: `Object.getOwnPropertyDescriptor` is a function of
`Object`, so a read that goes through it is a read on an object, and asking
`Object` about a string, a number or a function is a category error, which
the guard makes a throw instead of the boxing JavaScript performs silently.

- **`['.', a, key]` — a known name.** The key is a literal or a constant the
  compiler resolves, so every check is static: the prohibited names refused
  at the key, `name` among them, `length` allowed. `a.b`, `a["b"]`, `a[0]`
  and `a[Number(k)]` are its spellings. The executor reads it as an own
  property, `undefined` where there is none, as the value path does
  through `hasOwn` and as [`own-access.md`](./own-access.md) defines — that
  part of it stands; what this proposal changes is `own` and `name`. The
  writer's `a.b` agrees with that read under the assumption every
  FunctionalScript file run by a JavaScript engine already relies on, a
  realm whose prototypes are the standard's, since every standard
  prototype name is refused at the key.
  `f.name` and `person.name` are both refused here; the second has the
  other spelling.
- **`['own', a, b]` — an object's own name, a run-time operator with its
  guards inside.** Both operands are expressions, `['own', Exp, Exp]`, and
  the operator checks them itself. The base must be an object — a plain
  object or an array — and anything else throws: `null` or `undefined` as
  JavaScript's read throws, a string, a number, a bigint, a boolean or a
  function through the guard. The key is any value, converted to a
  property key as JavaScript converts one: a string as is; a number, a
  bigint, a boolean, `null` or `undefined` by its `ToString`, so `0` reads
  `"0"` and `true` reads `"true"`; an array or an object by `ToPrimitive`
  then `ToString` — an own `toString` or `valueOf` function called if the
  value carries one, else `"[object Object]"` for an object and the joined
  items for an array. A function as the key throws, since its `ToString`
  is source text the name-erased graph does not carry. Within those, the
  operator reads the own property, `undefined` where there is none. The
  source form is the guarded descriptor expression, recognized as one
  pattern:

  ```js
  Object.getOwnPropertyDescriptor(typeof a === 'object' ? a : null, b)?.value
  ```

  `person.name` reads `"x"`, `f.name` throws, and JavaScript agrees on
  every case, since the source spells the base guard itself and
  `getOwnPropertyDescriptor` converts the key exactly so — the pattern
  accepts `b` as a number, a boolean or anything else, and the operator
  means what the pattern means. The one divergence is the function key,
  fail-stop as `f.name` is: the executor throws where JavaScript reads the
  property named by the function's source text, and the writer spells no
  guard for it, since JavaScript has no throw expression and the value
  JavaScript would read is one the graph cannot carry either way. Splitting
  the guards into nodes of their own
  was weighed and set aside for later: one operator that owns its
  preconditions is the simpler contract, and a node the schema types is
  a refinement it can grow into.
- **`name` is unobservable.** `.` refuses it statically and `own` throws on
  a function, so no FunctionalScript program reads a function's `name`. `=>`
  carries no name, the graph stays name-erased, the writer's `$0` is
  invisible, and `function-name.md` closes. The same guard applies to every
  `Object` function the language admits
  ([`2360-built-in.md`](../../../spec/todo/2360-built-in.md)) — `entries`,
  `keys`, `values`, `getOwnPropertyNames`, `getOwnPropertyDescriptors`,
  `hasOwn` — each a pattern whose receiver is `typeof a === 'object' ? a : null`,
  so a function is not an object to any of them and
  `Object.getOwnPropertyDescriptors(f)` throws rather than handing `name`'s
  descriptor out as data. That is the principle applied uniformly: a
  function of `Object` reads objects.
- **`a[b]` with an unknown `b` stays refused.** It cannot lower to `own`:
  JavaScript's `a[b]` walks the prototype chain and `own` does not, and `b`
  may be `"constructor"` at run time. The descriptor pattern is the source
  form for a run-time key, and it means the same in both.
- **Both executors, one answer.** The native VM's `own` is pinned today by
  the conformance corpus in [`fjs/nanvm`](../../nanvm/module.f.mjs)
  (`ownCases`), which generates the Rust vectors and documents
  `Any::own_property` in `nanvm-lib`: there an array is not a receiver, and
  a primitive or a function answers `undefined` rather than throwing. Under
  this proposal an array is an object and reads its own properties, `'0'`
  and `length` included, and a primitive or a function throws through the
  guard, so the corpus, the generated vectors, `Any::own_property` and its
  documentation change with amnesia, in the same PR, and the JavaScript and
  native executions keep agreeing on every listed input.
- **Unchanged.** `length` and `name` are own and not enumerable, read by
  the operator that admits them and absent from `Object.entries`; the
  analysis merges `.` and `own` alike as plain reads, since neither mints
  identity; the writer spells `.` by its four forms and `own` by the
  pattern; `?.` and `|.` stay control flow.

### Tasks

- [ ] `own` stays in the `op2` ids, `['own', Exp, Exp]`, with the guarded
      semantics; the README's table says which read each node is and why,
      the sentence about `Object` first.
- [ ] Amnesia's `own` checks the base and the key and reads the descriptor,
      with proofs for an object, an array, `null`, a string, a number and a
      function as the base; a number, a boolean, `null`, an array, an object
      with its own `toString`, and a function as the key; a missing property;
      and `name` on a function throwing.
- [ ] The native VM follows in the same PR: `ownCases` in `fjs/nanvm` and the
      vectors it generates take the guarded answers — an array a receiver with
      `'0'` and `length`, a primitive or a function a throw as the base, a
      non-string key converted rather than refused, a function key a throw —
      and `Any::own_property` in `nanvm-lib` and its documentation with them,
      the key conversion included.
- [ ] The parser recognizes the guarded descriptor pattern as `own`, any
      expression as its key, and keeps `name` prohibited for `.`; proofs for
      `person.name` through the pattern, a number key through it, and `f.name`
      refused through `.`.
- [ ] Later, if wanted: the guards as nodes the schema types.
- [ ] `own-access.md` and `function-name.md` closed in favor of this, and the
      references to them in `analysis.md`, `is-operator.md`,
      `functionalscript-output.md` and `interpret-edag.md` repointed.
- [ ] `2360-built-in.md` states the receiver guard for every admitted
      `Object` function, `getOwnPropertyDescriptors` included, so that no
      reflection reaches a function's `name`.
- [ ] The spec todos updated in the same migration:
      [`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
      spells `own_property` with the guarded descriptor read instead of the
      unguarded one, and
      [`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)
      takes the same receiver rule for `Object.hasOwn` — an
      array a receiver, a primitive or a function a throw — in place of the
      `Object`-only scope it inherits from the current `own`.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`own-access.md`](./own-access.md) — the one-node proposal this replaces.
- [`function-name.md`](./function-name.md) — the name operand this makes
  unnecessary.
- [`../amnesia/README.md`](../amnesia/README.md) — the `own` read the
  executor keeps.
- [`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md) —
  `Object.getOwnPropertyDescriptor` among the allowed built-ins.
