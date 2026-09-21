## Stage A binary operators, and `~`, have no FunctionalScript spelling yet

**Priority:** P2
**Status:** open

### Problem

Stage A of [operators](../../../../spec/todo/2340-operators.md) made the
eighteen binary operators and `~` reachable from source — the parser, AST
and EDAG lowering all accept them — but this writer still only spells
unary `-`. Every other operator node falls to the `default` case and is
refused, each by name, with nothing written:

```sh
$ fjs compile in.f.js out.js   # in.f.js: export default 1 + 2;
out.js - error: a + node
```

That refusal is this module's own documented behavior for a node kind it
has no spelling for (`./module.f.mjs`'s own leading comment), so it is not
a crash or a wrong answer — but it does mean `fjs compile a.f.js b.f.js`
cannot round-trip any module that uses one of these operators, even though
[`spec/README.md`](../../../../spec/README.md#operators) now documents them
as part of the language the compiler accepts. The module's own contract is
that a feature adding a node kind adds its spelling in the same change;
Stage A's parser/AST/EDAG PR did not, and is scoped to the front end
(reaching these operators from source), not every backend.

### Proposal

Add a `case` per operator to `entry`'s `switch`, each producing the
`Document` for `left OP right` (or `OP operand` for `~`), reusing
`operand`/`base` the way the existing `-` case does. The real work is
precedence-correct parenthesization: the written text has to read back to
the same graph, so an operand whose own precedence is lower than the
position it is written in needs `(` `)` around it — exactly the ladder
`fjs/fsc/parser/grammar/module.f.mjs`'s `multiplicativeTail` through
`bitwiseOrTail`, `powTail`, and `unaryOperand` already encode, read in
reverse. `-`/`~` immediately before `**` need the same care the parser's
own `unaryOperand` rule does: this writer must never emit a bare `-x ** y`
that the parser would refuse to read back.

`**`'s right-associativity and the rest's left-associativity both need
tracking (which side of a same-precedence operator needs the parens the
other side does not), the same shape unary `-`'s own spacing rule
(`- -1` not `--1`) is a narrow instance of already.

### Tasks

- [ ] Add spelling for `+ - * / % **` and comparison/bitwise, precedence-
      and associativity-correct, in `fjs/fsc/serializer/module.f.mjs`'s
      `entry`.
- [ ] Add spelling for `~`.
- [ ] New proof coverage: every operator round-trips (`fjs t`'s
      `fjsRoundTrip`-style check, `../../proof.f.mjs`), every precedence
      case that needs parens gets them, and the `-`/`~`-before-`**`
      refusal is never spelled unparenthesized.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `entry`, where the `case '-':` this
  extends lives, and the module's own leading comment documenting the
  refusal-by-name contract this closes.
- [`../../parser/grammar/module.f.mjs`](../../parser/grammar/module.f.mjs) —
  the precedence ladder (`multiplicativeTail` through `bitwiseOrTail`,
  `powTail`, `unaryOperand`) this writer's parenthesization has to invert.
- [`spec/todo/2340-operators.md`](../../../../spec/todo/2340-operators.md) —
  Stage A itself.
- [`../../rust/module.f.mjs`](../../rust/module.f.mjs) — the `.rs` output,
  which prints every eager operator already, as `(…)?`; the same gap was
  filed alongside this one and is closed.
