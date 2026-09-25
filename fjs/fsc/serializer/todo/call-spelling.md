## Spell calls and method-call chains

**Priority:** P2
**Status:** open

### Problem

The FunctionalScript writer in [`../module.f.mjs`](../module.f.mjs) has no
spelling for either call form. An ordinary call, `['()', callee, args]`, falls
to `entry`'s `default` case, and a `.` node with a continuation — a method call
or a longer chain — is refused in the `'.'` case:

```sh
$ fjs compile in.f.js out.js   # in.f.js: const f = a => b => a + b; export default f(1)(2);
out.js - error: a () node
$ fjs compile in.f.js out.js   # in.f.js: const o = { f: (...a) => 1 }; export default o.f();
out.js - error: a chain step
```

The refusal is the module's documented behavior for a node kind it cannot
spell, so it is not a wrong answer. But calls are in the language: the same
modules compile to `.rs` and `.edag.data.js`, and a module that calls a
function cannot round-trip to `.js`. The value outputs, `.data.js` and
`.json`, refuse a call for a different reason — applying a function is the
interpreter's work ([interpret-edag](../../todo/interpret-edag.md)) — and
that refusal is not this issue.

### Tasks

- [ ] Spell `['()', callee, args]` in `entry`, parenthesizing a callee whose
      text would otherwise read back as something else (a function, an
      operator expression).
- [ ] Spell a `.` node's continuation — `['|()', args]` and a `|.` step —
      so a method call keeps its receiver and reads back to the same node.
- [ ] Proofs: each form round-trips through the parser (`fjsRoundTrip` in
      [`../../proof.f.mjs`](../../proof.f.mjs)), including a call of a call
      and a method call on a computed receiver.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [stage-a-operators](./stage-a-operators.md) — the same gap for operators.
- [`spec/README.md`](../../../../spec/README.md#functions) — calls in the
  language.
