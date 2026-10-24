## frame-advance. One round for the counting frames, with per-kind facts as data

**Priority:** P4
**Status:** open

### Problem

The explicit-stack evaluator in [`module.f.mjs`](../module.f.mjs) keeps
frames that count operands, over the shared `_Counted<T>` base (`index`,
`done`) in [`private.ts`](../private.ts). The step past an operand is
written once, `advanced`, and so is a binding statement's value landing
in a frame that counts entries, `landed` — a block body's `const`, a loop
block's and a late parameter. What is still written per kind is the round
each re-enters — `round`, `callRound`, `chainRound`, `conditionalRound`,
`bodyRound`, `loopRound`, `lateRound` — each "if there is another operand,
enter it under this frame; otherwise close", with the per-kind facts
inlined: how many operands there are, which node operand `index` is, the
check an operand earns before it is entered, and how the frame closes.

### Proposal

One round, with the per-kind facts as data:

```ts
/** What a counting frame knows about its operands. */
type _Operands<F> = {
    readonly count: (f: F) => number
    readonly at: (f: F, i: number) => Node
    /** The frame to suspend and the node to enter for entry `i`, or the error the entry earns first. */
    readonly enter: (f: F, scope: _Scope, i: number) => Result<readonly [F, Node], string>
    /** The value the frame closes to, and the scope in force after it. */
    readonly close: (f: F, scope: _Scope, done: readonly AstConst[]) => readonly [_Scope, AstConst]
}
```

### Why it waited

The rounds have drifted from the sketch since it was written, and the
table no longer fits them as data:

- a container enters a computed key and then the value at the same
  `index`, holding the key in `key` between them, so its step is not one
  operand per round;
- a chain judges a constant key in the round itself and steps past it
  without entering anything;
- a block body's round chooses among six statement kinds, and a `let`
  pushes a `_LetFrame` rather than the body's own frame; a body (and a
  loop's block) closes through `closed`, which rewrites the stack and the
  scope, not by building a node; and a statement's step appends the
  several entries it lowers to and counts them in `entries`.

`enter`/`close` hooks wide enough for all of that return a whole
`_State`, at which point the table is the rounds behind one more
indirection. Calls and conditionals are the two kinds the table fits as
written, and their rounds are seven lines each; collapsing only those two
trades two short, direct functions for a generic one and its two tables.
A new counting frame ([statement-aware-intrinsics](./statement-aware-intrinsics.md))
is the point to decide whether the table pays for itself.

### Tasks

- [ ] `_Operands` for the kinds that fit; their rounds collapse into one
      round over it — decided when the next counting frame lands.
- [ ] `tsc`, `fjs test`; the parser proofs pass unchanged.

### Related

- [statement-aware-intrinsics.md](./statement-aware-intrinsics.md) — keeps
  the explicit stack and adds a frame kind; one round is where it lands.
