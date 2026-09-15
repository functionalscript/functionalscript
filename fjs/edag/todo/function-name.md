## A function's `name`: `=>` carries a name expression

**Priority:** P3
**Status:** open

### Problem

`name` is an own property of every function, readable through the own read
([`own-access.md`](./own-access.md)), and JavaScript gives it a value by
where the function is written: `const f = (...a) => 5` names it `"f"`,
`{ k: (...a) => 5 }` names it `"k"`, `{ [n]: (...a) => 5 }` names it the
value of `n` at run time, `export default (...a) => 5` names it
`"default"`, and `[(...a) => 5]` leaves it `""`. The EDAG carries none of
that: `['=>', frame, body]` is the name-erased function, so the memo
executor's closure has whatever name the host gives it, the writer's
`const $0 = …` renames it `"$0"`, and a program reading `f.name` means
something different under each. That is why `own-access.md` states the
value as implementation-defined — a gap, not a design.

### Proposal

`=>` takes a name expression: `['=>', frame, body, name]`, with `name` an
`exp` evaluated in the enclosing scope when the function is constructed, as
the frame is, to the string JavaScript would give — the compiler computes it
by JavaScript's own naming rules at lowering, so the graph means what the
source means:

- `const f = (...a) => 5` lowers with `"f"`; an object member with its key,
  a computed key with the key's expression; `export default` with
  `"default"`; an array item or an argument with `""`.
- The name operand denotes a property key: a string as is, a number by
  its `ToString` — `{ [1]: (...a) => 5 }[1].name` is `"1"` — and nothing
  else, since the language has no symbol; the executor sets that string as
  the function's `name`. The analysis treats the operand as any other, so a
  name that reads the arguments is a body-scope dependency like a frame's.
- **Writing it back, and reading it.** The spelling
  `{ [$name]: (...$a) => body }[$name]` is a pattern the parser recognizes
  as one operator, the named function, and lowers straight to
  `['=>', frame, body, name]` — no object and no access in the graph, as
  `Object.is(a, b)` lowers to `is` and `hasOwn` to its own read
  ([`2345-has-own-property.md`](../../../spec/todo/2345-has-own-property.md)).
  The key and the index must be the same identifier or the same string
  literal, so the name is one expression evaluated once, and any name is
  allowed, `constructor` and `__proto__` included, since nothing reads a
  property: `const constructor = (...a) => 5` round-trips through
  `{ ["constructor"]: (...$a) => 5 }["constructor"]`. The writer uses the
  pattern wherever its own binding would not infer the name — a hoisted
  `$0`, a name that is not an identifier, a computed one, `""` — and
  `const f = (...$a) => 5` where it would. JavaScript reads the pattern as
  it reads any computed key, so the text means the same in both.
- **Hashing.** The graph is no longer fully name-erased: a function's own
  name is part of what it denotes, since a program can read it, and so part
  of its hash. Binding names stay erased.

### Tasks

- [ ] The schema and `types.ts`: `=>` with a fourth operand, one spelling —
      the name always present, `""` for none — and the README's table.
- [ ] Lowering: the compiler computes the name by JavaScript's rules at every
      position a function can stand, with proofs for each of the five above.
- [ ] Amnesia and the operation table set `name` on construction; proof that
      `f.name` reads it back and that `Object.entries` omits it.
- [ ] The parser recognizes the pattern `{ [k]: (...a) => body }[k]`, `k` one
      identifier or one string literal at both places, as the named function,
      with any name; the writer's spellings, with the round trip proved on each
      position.
- [ ] `own-access.md`'s "implementation-defined" replaced by this.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`own-access.md`](./own-access.md) — the read that exposes `name`.
- [`../README.md`](../README.md) — the node table and the name-erasure
  sentence this qualifies.
- [`fjs/fsc/todo/functionalscript-output.md`](../../fsc/todo/functionalscript-output.md)
  — the writer that must reproduce the name.
