## Throw statement

**Priority:** P2
**Status:** open

**Approval:** none yet. A language feature needs formal, explicit approval
from a language designer other than the proposer before implementation
([DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo));
record the approver and a link to the approval here.

### Problem

The language has no way to fail on purpose. Its semantics already define
what a failure is — [one indistinguishable outcome](../README.md#failure-is-one-outcome),
`throw A ≡ throw B ≡ memory failure ≡ time failure`, which is the contract
`null.x` and `1n / 0n` fail under today — and the repository's policy already
reserves `throw` for exactly that: a panic on a broken invariant, never an
expected error, which travels as a `Result`
([io-effects](./io-effects.md#52-operation--the-interface-to-the-host),
[`fjs/AGENTS.md` §1.5](../../fjs/AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key),
[DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)). But a
function can reach the outcome only by accident, through an operation that
happens to fail, not by saying so.

That gap is what holds the repository's own migration to `.f.js`. The
compiler refuses `throw`, so `fjs/asserts` — `assert` is
`(v, msg) => { if (!v) throw msg }` — stays `.f.mjs`, and every module that
imports it, directly or through another, stays with it: at `2c16aecd`, all
but about a score of the repository's `module.f.mjs` files sit above one of
the modules that throw, `fjs/asserts`, `fjs/types/result`,
`fjs/types/btree/remove` and `fjs/text/ascii` among them, so no
dependency-closed group can rename until those do. Every `proof.f.mjs` fails
by throwing too, which is why a `module.f.js` keeps a `proof.f.mjs`
([`fjs/compiler/README.md`](../../fjs/compiler/README.md#source-files-and-repository-migration)).

The design has been sketched but never proposed:
[edag-stage1-discussion](../../todo/edag-stage1-discussion.md) gives `throw`
a word-tagged EDAG node, `["throw", v]`, because JavaScript spells it as a
statement and there is no operator symbol to reuse, and notes that with it an
assertion is expressible inside the EDAG, `["?:", cond, ["undefined"], ["throw", …]]`,
without any host function. It leaves open how a `throw` inside an expression
would be spelled in source. This proposal settles that by not needing it.

### Proposal

`throw value;` is a statement, in a function's block body, in the position
`return value;` holds: a block is any number of `const` statements and then
one terminating statement, which is a `return` or a `throw`. A function
whose body ends in `throw` always fails when called.

```js
export const todo = () => { throw 'not implemented' };
export const checked = n => {
    const half = n / 2;
    throw ['not yet', half];
};
```

Everything else about it is JavaScript's, read as the specification reads
`return`:

- **The value is any expression, and it is evaluated first.** `throw f(x)`
  calls `f` before failing, as in JavaScript; a value that itself fails to
  evaluate fails the call all the same. Under the failure contract an
  implementation may not distinguish the two, and neither may a program.
- **The thrown value is not a program observation.** Nothing in the language
  can catch it, so no FunctionalScript program returns a different result for
  a different payload. Executors *should* carry it out of band — the test
  runner reads it, and a human reads it after something has gone wrong — but
  the language promises the failure, not the payload
  ([failure is one outcome](../README.md#failure-is-one-outcome)).
- **`throw` and its value share a line.** JavaScript's restricted production
  forbids a line terminator between them: `throw` alone on a line is an early
  error there, so it is refused here, exactly as a newline after `return` is
  ([functions](../README.md#functions)). `throw;` with no value is not
  JavaScript and is refused.
- **Nothing follows it in the block.** A statement after the terminating one
  is unreachable. JavaScript allows the text; refusing it prevents the
  mistake it can only be, the same reason a block may not fall off its end
  without a `return` ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
- **A module body has no `throw`.** JavaScript accepts one at the top level,
  where it would make the module fail at every load and its value
  unreachable, so no output could ever be written for it. Refusing it at
  compile time reports that mistake where it is made rather than at load; a
  use for a module that always throws can lift the restriction later.
- **Lowering.** The body `{ const …; throw v; }` lowers to a body whose value
  is the node `['throw', v]`, an operation of one operand that always fails,
  the "provably throwing" node the stage-1 discussion describes. It follows
  the discussion's positional laziness: in an eager position it is evaluated
  and fails, and in a lazy one — an arm of `?:`, the right operand of `&&`,
  `||` or `??` — it is not established unless JavaScript would establish it,
  so an implementation never speculates it into a position the source did
  not reach. Once [`if`](./README.md#32-priority-2) lands as surface syntax
  over `?:`, `if (!v) throw msg` is `['?:', cond, ['throw', msg], rest]`, and
  `assert` compiles with no node this proposal does not add.
- **Outputs.** The FunctionalScript writer spells the node as the statement
  it came from; the EDAG output carries it; the Rust output fails as the
  VM fails. The value outputs are unchanged: a function is refused by them
  already, and a module whose load reaches a `throw` fails to load, which
  they refuse as they refuse a load that reaches `null.x`.

**Benefits.** The source is JavaScript as written today, in the one spelling
the repository already uses. A panic becomes a language construct rather than
a side effect of the nearest failing operation, which is what
[DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle) asks a
program to do with an input it cannot handle. Together with `if` and logical
`!`, it lets `fjs/asserts` and the foundational modules above it rename to
`.f.js`, and after them the proofs, which is the migration
[fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md#repository-compiler-compatibility-migration)
tracks. An assertion is then expressible in the EDAG itself, so the Rust VM
runs one without a host function.

**Drawbacks.** The block grammar gains a second terminating statement, and
the EDAG a node kind that every writer, evaluator and analysis must handle:
the FunctionalScript, EDAG and Rust writers, the JavaScript evaluators, the
Rust VM and the sharing analysis, whose contract is that a feature adding a
node kind adds its spelling in the same change. A statement that always
fails is a temptation to signal expected errors with it, against the
`Result` policy; the policy stands, and the proposal adds no `try`/`catch`
to make the temptation useful. A function ending in `throw` returns nothing,
which TypeScript types as `never`; JSDoc handles that today for `todo`.
`throw` is a statement only, so an expression that needs to fail still goes
through a function that throws, `(() => { throw v })()`, as JavaScript would
have it; an expression form is not proposed, the stage-1 discussion's
alternatives being unnecessary once the statement exists.

### Tasks

- [ ] Approval from a language designer other than the proposer, recorded
      above.
- [ ] Grammar: `block` takes `throw value end` where it takes
      `return value end`, with the same line-terminator refusal
      ([`fjs/compiler/parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs)).
- [ ] AST and EDAG: the `['throw', v]` node, its rtti schema and `types.ts`
      entry, its evaluation in the JavaScript evaluators and the Rust VM, and
      its place in the sharing analysis as a node that is never speculated.
- [ ] Writers: the FunctionalScript spelling `throw v;` in a block; the EDAG
      output; the Rust output; value outputs unchanged.
- [ ] Proofs: a body ending in `throw`, `throw` after `const`s, the newline
      and empty-value refusals, a `throw` in a `?:` arm not established, and
      a module-level `throw` refused — in the parser, EDAG, transpiler and
      serializer proofs, using the test runner's `throw` key.
- [ ] Fold the statement into [functions](../README.md#functions) and delete
      this file and its roadmap entry.
- [ ] After `if` and logical `!`: rename `fjs/asserts` to `.f.js`, then the
      modules that depend on it, then the proofs
      ([fjs-nanvm-integration](../../todo/fjs-nanvm-integration.md#repository-compiler-compatibility-migration)).

### Related

- [Failure is one outcome](../README.md#failure-is-one-outcome) — the
  semantics a `throw` reaches.
- [`if`](./README.md#32-priority-2) — the other half of `assert`; its own
  proposal is still to be written.
- [let](./3220-let.md) — the neighbouring statement proposal.
- [edag-stage1-discussion](../../todo/edag-stage1-discussion.md) — the
  `["throw", v]` node, positional laziness and the open expression-form
  question this proposal closes.
- [io-effects](./io-effects.md) — why expected failures are `Result`s and
  `throw` is a panic.
- [`fjs/AGENTS.md` §1.5](../../fjs/AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)
  — the test runner's `throw` key, unchanged by this proposal.
- [`fjs/compiler/README.md`](../../fjs/compiler/README.md#source-files-and-repository-migration)
  — why a `module.f.js` keeps a `proof.f.mjs`.
