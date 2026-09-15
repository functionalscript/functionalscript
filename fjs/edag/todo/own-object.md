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
  and `a[Number(k)]` are its spellings, and the executor reads it as today.
  `f.name` and `person.name` are both refused here; the second has the
  other spelling.
- **`['own', a, b]` — an object's own name.** The source form is the whole
  guarded expression, recognized as one pattern:

  ```js
  Object.getOwnPropertyDescriptor(typeof a === 'object' ? a : null, b)?.value
  ```

  The base must be an object at run time: a plain object or an array reads
  its own property, `undefined` where there is none; `null` throws through
  the call; a string, a number, a bigint, a boolean or a function throws
  through the guard. The key is any string, computed or not. `person.name`
  reads `"x"`, `f.name` throws, and JavaScript agrees on every case, since
  the source spells the guard itself. The executor evaluates exactly that
  expression, as amnesia's `own` does today.
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

- [ ] `own` stays in the `op2` ids with the guarded semantics; the README's
      table says which read each node is and why, the sentence about
      `Object` first.
- [ ] Amnesia's `own` evaluates the guarded expression, with proofs for an
      object, an array, `null`, a string, a number, a function, a missing
      property, and `name` on a function throwing.
- [ ] The native VM follows in the same PR: `ownCases` in `fjs/nanvm` and the
      vectors it generates take the guarded answers — an array a receiver with
      `'0'` and `length`, a primitive or a function a throw — and
      `Any::own_property` in `nanvm-lib` and its documentation with them.
- [ ] The parser recognizes the pattern, lowers it to `own`, and keeps `name`
      prohibited for `.`; proofs for `person.name` through the pattern and
      `f.name` refused through `.`.
- [ ] `own-access.md` and `function-name.md` closed in favor of this, and the
      references to them in `analysis.md`, `is-operator.md`,
      `functionalscript-output.md` and `interpret-edag.md` repointed.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`own-access.md`](./own-access.md) — the one-node proposal this replaces.
- [`function-name.md`](./function-name.md) — the name operand this makes
  unnecessary.
- [`../amnesia/README.md`](../amnesia/README.md) — the `own` read the
  executor keeps.
- [`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md) —
  `Object.getOwnPropertyDescriptor` among the allowed built-ins.
