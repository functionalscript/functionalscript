## frame-advance. Three frame kinds step the same way, and `returned` says so twice

**Priority:** P4
**Status:** open

### Problem

The explicit-stack evaluator in [`module.f.mjs`](../module.f.mjs) keeps
three frames that count operands — `_ContainerFrame`, `_CallFrame` and
`_BodyFrame` in [`private.ts`](../private.ts) — and each carries the same
`index` and `done: List<AstConst>`. `returned` advances two of them with
one expression written twice, character for character but for the frame
tag and the round it re-enters:

```js
// returned
if ('container' in frame) { return round(stack, env, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
if ('call' in frame) { return callRound(stack, env, { ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }) }
```

and the third, under `'statements' in frame`, spells the same advance a
third time inside its `const` arm. The three rounds — `round`,
`callRound`, `bodyRound` — are each "if there is another operand, enter
it under this frame; otherwise close", with the per-kind facts inlined:
how many operands there are (`container[1].length`, `callOperandCount`,
`statements.length`), which node operand `index` is (`itemAt`,
`callOperandAt`, a statement's value or return expression), the check an
operand earns before it is entered (`badKey`, nothing, `bindable`), and
how the frame closes (`close`, the `['()', callee, args]` build, the
`['=>', …]` build). [statement-aware-intrinsics](./statement-aware-intrinsics.md)
is going to add a fourth counting frame on top of this.

### Proposal

One advance and one round, with the per-kind facts as data:

```ts
/** What a counting frame knows about its operands. */
type _Operands<F> = {
    readonly count: (f: F) => number
    readonly at: (f: F, i: number) => Node
    /** The frame to suspend and the node to enter for entry `i`, or the error the entry earns first. */
    readonly enter: (f: F, env: _Env, i: number) => Result<readonly [F, Node], string>
    /** The value the frame closes to, and the environment in force after it. */
    readonly close: (f: F, env: _Env, done: readonly AstConst[]) => readonly [_Env, AstConst]
}
const advance: (stack: _Stack, env: _Env, frame: _CountingFrame, value: AstConst) => _State
```

`advance` is the `{ ...frame, index: frame.index + 1, done: concat(frame.done)([value]) }`
written once, followed by the one round; `returned` loses two of its
arms and the body arm keeps only what is its own — extending `env` with
the name just bound. `enter` returns the frame as well as the node because one kind changes
its frame on the way in: for a block-body `const`, `bindable` yields the
normalised name that `bodyRound` stores in `frame.word` before the
initializer is entered, and `returned` reads it back to extend `env`. A
hook that answered only the error would lose that name. Containers and
calls return their frame unchanged; the body kind returns
`{ ...f, word }`, or `[f, statement]` for a `return`. `badKey` fits the
error half of `enter` as it is;
`bodyRound`'s `bindable` check is its success half. `close` returns the
environment as well as the value for the mirror-image reason: a body was
entered under its own names, and today's `returned` restores `frame.outer`
when the last `return` completes. Containers and calls close to `[env, …]`
unchanged; the body kind closes to `[f.outer, ['=>', …]]`, so the
parameter and the body's `const`s go out of scope exactly where they do
now. `_ContainerFrame`, `_CallFrame`
and `_BodyFrame` share one base with the payload that differs.

### Tasks

- [ ] `_Operands` for the three kinds; `advance`; `round`/`callRound`/
      `bodyRound` collapse into one round over it.
- [ ] `tsc`, `fjs test`; the parser proofs pass unchanged.

### Related

- [statement-aware-intrinsics.md](./statement-aware-intrinsics.md) — keeps
  the explicit stack and adds a frame kind; one round is where it lands.
