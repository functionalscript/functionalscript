## Two access nodes: `.` for a known name, `own` for an object's own name, with `asObject` as its guard

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
  and `a[Number(k)]` are its spellings, and the executor reads it as today.
  `f.name` and `person.name` are both refused here; the second has the
  other spelling.
- **`['asObject', a]` — the guard.** It is `typeof a === 'object' ? a : null`:
  an object, an array or `null` passes through, and a function or any
  primitive becomes `null`. A unary operation, reusable wherever an object
  is required. It is not ECMAScript's `ToObject`, which boxes a primitive
  and throws only on `null` and `undefined`; the name says what it does,
  and `object` was avoided since it reads as a constructor. The source form
  is the ternary itself, recognized as one pattern, so JavaScript agrees by
  construction.
- **`['own', base, key]` — an object's own name.** It is
  `Object.getOwnPropertyDescriptor(base, key)?.value`, and its base operand
  is typed by the schema: an `asObject` node, or a node the schema already
  knows is an object, `[]` or `{}`. So a parameter or an import reaches
  `own` only through `asObject`, and a graph with `own` over a bare
  `args[0]` is not a graph — unspellable, as the chains design makes a
  wrong shape unspellable, rather than caught by a validation pass:

  ```ts
  type AsObject = readonly ['asObject', Exp]
  type Own = readonly ['own', AsObject | ArrayLiteral | ObjectLiteral, Key]
  ```

  At run time a plain object or an array reads its own property,
  `undefined` where there is none; `null`, from `asObject` or written,
  throws through the call. `person.name` reads `"x"` through
  `own(asObject(person), "name")`, `f.name` throws, and JavaScript agrees
  on every case, since the source spells both halves. The source form of
  `own` is the descriptor pattern whose first argument is an `asObject`
  pattern or an object literal; over anything else it is refused. The key
  is a known string for now — a string literal or a constant whose value
  is a string — so the pattern's second argument is checked statically, as
  `.`'s key is, and no executor ever meets a non-string key: a number key
  is `.`'s, `a[0]`, and the existing refusal of a non-string key in the
  schema, amnesia and `Any::own_property` stays as the run-time backstop.
  A run-time key needs a `toKey` guard beside `asObject`, since
  `getOwnPropertyDescriptor` coerces its key and would call `toString` on
  an object, and that guard and what it does with a non-string are a
  follow-up.
- **`name` is unobservable.** `.` refuses it statically and `own` throws on
  a function, so no FunctionalScript program reads a function's `name`. `=>`
  carries no name, the graph stays name-erased, the writer's `$0` is
  invisible, and `function-name.md` closes. `Object.getOwnPropertyNames(f)`
  still lists `name`, which is the same for every function and reveals
  nothing.
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

- [ ] `asObject` joins the `op1` ids; `own` stays in the schema with its base
      operand typed as `asObject`, `[]` or `{}`, in the RTTI schema and
      `types.ts`; the README's table says which read each node is and why,
      the sentence about `Object` first, and that `asObject` is not
      `ToObject`.
- [ ] Amnesia evaluates `asObject` as the ternary and `own` as the descriptor
      read, with proofs for an object, an array, `null`, a string, a number,
      a function, a missing property, and `name` on a function throwing.
- [ ] The native VM follows in the same PR: `ownCases` in `fjs/nanvm` and the
      vectors it generates take the guarded answers — an array a receiver with
      `'0'` and `length`, a primitive or a function a throw — and
      `Any::own_property` in `nanvm-lib` and its documentation with them.
- [ ] The parser recognizes the ternary as `asObject` and the descriptor
      pattern over an `asObject` or an object literal as `own`, refuses it
      over anything else, keeps the key a known string, and keeps `name`
      prohibited for `.`; proofs for `person.name` through the patterns,
      `f.name` refused through `.`, and the descriptor pattern over a bare
      parameter refused.
- [ ] Follow-up, its own todo: `toKey`, the guard for a run-time key, and
      what it does with a non-string.
- [ ] `own-access.md` and `function-name.md` closed in favor of this, and the
      references to them in `analysis.md`, `is-operator.md`,
      `functionalscript-output.md` and `interpret-edag.md` repointed.
- [ ] The spec todos updated in the same migration:
      [`2330-property-accessor.md`](../../../spec/todo/2330-property-accessor.md)
      spells `own_property` with `asObject` as its receiver instead of the
      unguarded descriptor read, and
      [`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)
      takes the same receiver rule for `Object.hasOwn(asObject(a), b)` — an
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
