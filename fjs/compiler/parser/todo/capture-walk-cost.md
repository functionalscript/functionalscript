## capture-walk-cost. A read through many bodies costs a walk per read

**Priority:** P3
**Status:** open

### Problem

A name a body reads from a scope around it is a capture, resolved by
`resolve` in [`../module.f.mjs`](../module.f.mjs): a walk out to the scope
that binds the word and back in, each body on the way rebuilt with the
capture taken. The walk is a loop, so a read through twenty thousand bodies
costs no call stack — the proof in [`../proof.f.mjs`](../proof.f.mjs) pins
that — but it costs a step per body *every time*, since a body remembers a
capture it took only in its `captures` list, by reference and not by word,
and `resolve` learns nothing from a word it has resolved before.

A body of many guards is where that shows. Each guard's arms are bodies of
their own nested in the one before, so the *k*-th guard's condition reads
the function's parameter through *k* bodies, and a body of *n* guards costs
about *n²/2* steps to resolve. At `93756c1f`, on one machine:

| body | 2,000 | 5,000 |
|------|------:|------:|
| `if (a) { return 1; }` × n | 1.8 s | 10.2 s |
| `const cᵢ = a;` × n | 0.5 s | 1.2 s |
| `() => ` × n, one read | 0.2 s | 0.5 s |

Memory is flat, about 80 MB either way, since the continuation shares the
statement list it continues and the enclosing environments are a list. The
time is the walk.

### Proposal

Let a body remember the words it has captured, so that a read the body has
already resolved is answered at the body and never walks past it. The
natural place is the body's `names`: a captured word bound to its `fref`
slot there makes the next read of it, in that body or in one nested in it,
resolve one level out at most, and turns the *n²/2* into *n*. Two things
then move with it:

- `bindable`, which refuses a `const` of a name the environment holds as
  `duplicate id`, would meet a captured word there and has to answer
  `capture shadowed` for it instead — the fold's existing refusal for a
  `const` of a word the body already read from outside — which is the
  `read` list's whole job today, so `read` may go.
- The rebuild on the way back in, `captured`, extends `names` as well as
  `captures`, and the scope chain the caller receives is what it is today
  with the memo added.

Not done in the guard's own pull request: the cost is the resolver's, paid
by any read through many bodies, and a body of thousands of guards is not
where the migration's code is.

### Related

- [body-const-forward-reference](./body-const-forward-reference.md) — the
  same `capture shadowed` refusal, and the `read` list it turns on.
- [spec: functions](../../../../spec/README.md#functions) — the guard and
  what it is sugar for.
