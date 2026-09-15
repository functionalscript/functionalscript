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
- The executor sets the function's `name` to the expression's value; the
  analysis treats the operand as any other, so a name that reads the
  arguments is a body-scope dependency like a frame's.
- **Writing it back.** The writer makes the text infer the same name. Where
  its own binding would, `const f = (...$a) => 5`, nothing is needed; where
  it would not — a hoisted `$0`, a name that is not an identifier, a
  computed one — the spelling is the computed-key object read,
  `{ [$name]: (...$a) => 5 }[$name]`, which names the function `$name`'s
  value and is its own read, so it round-trips; `""` is that spelling with
  `""`, since `(0, fn)` waits on the comma and grouping. The name operand
  is written twice there, and follows the writer's general rule
  ([`functionalscript-output.md`](../../fsc/todo/functionalscript-output.md)):
  a primitive takes no index and costs nothing; an identity-free node, an
  access or an operator, is written in place at both positions and the
  recompiled pair merges again; an identity-minting node, a call, is
  hoisted into a `const` at module level so both positions read one node,
  and inside a body that hoist is refused until body constants, like every
  other body hoist. So the graph's one evaluation stays one.
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
- [ ] The writer's spellings, with the round trip proved on each position.
- [ ] `own-access.md`'s "implementation-defined" replaced by this.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`own-access.md`](./own-access.md) — the read that exposes `name`.
- [`../README.md`](../README.md) — the node table and the name-erasure
  sentence this qualifies.
- [`fjs/fsc/todo/functionalscript-output.md`](../../fsc/todo/functionalscript-output.md)
  — the writer that must reproduce the name.
