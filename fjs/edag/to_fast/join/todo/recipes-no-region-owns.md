## Place a recipe no one region owns

**Priority:** P2
**Status:** open

### Problem

A lazy recipe that stays lazy needs first-demand memo storage, which
FunctionalScript source cannot spell, so source output refuses the program:
`a shared node reached from outside the lazy operand that establishes it`.
`fjs compile fjs/module.f.js out.f.js` is still refused that way; the blocks
it stops at are in [`compiler/edag`](../../../../compiler/edag/module.f.js).

[`placed`](../module.f.js) has three ways to give a recipe a place: at its
first proven demand, inside the one selected arm that holds every read of
it, or where it stands when its block reads it on every path that completes.
Two shapes fit none of them. Both are written here as the FAST the pass
receives, with `cell` the recipe, `c` a binding and `L` a loop the block is
inside.

**Read on every path, one of which leaves.**

```js
[['define', cell, call, 'lazy'],
 ['if', [], ref(c), { statements: [['if', [], ['===', ref(cell), 1],
     { statements: [], exit: ['break', L, []] }, normal()]], exit: ['yield', []] }, normal()]]
// exit: ['yield', [ref(cell)]]
```

Every path reads `cell`: in the inner test where `c` holds, and at the exit
otherwise or after. `certain` walks what the block evaluates in order and
stops at the first statement that can leave it, so it never sees the read
at the exit. A path that leaves is still a path that completes, and it read
the recipe before leaving.

**Read in the only arm that goes on.**

```js
[['define', cell, call, 'lazy'],
 ['if', [], ref(c), { statements: [], exit: ['break', L, []] },
     { statements: [['define', a, ['array', [ref(f), ref(cell)]], 'required']], exit: ['yield', []] }]]
// exit: ['yield', [ref(cell)]]
```

Where `c` holds the block is left and `cell` is never read, so it may not be
required where it stands. What follows the statement runs only after the
second arm, but it is not inside that arm, so the recipe has no one arm.

### Proposal

Two changes, each its own pull request. The first replaces `certain`; the
second adds one more place a recipe can be put.

#### 1. The all-paths rule

`certain` answers "does the block read the recipe on every path that
completes" by walking values in order and giving up at the first thing that
can leave. Ask the question itself instead.

For a region `R`, a binding `t` declared outside it, define `unread(R)`:
the set of ways `R` can end **without having read `t`**. A way is `normal`
(the region completes and what follows it runs) or a transfer target: the
function a `return` names, or a loop with the kind of transfer, `break L`
or `continue L`. A failure is not a way: a path that fails before the read
fails either way
([spec](../../../../../spec/principles/README.md#failure-is-one-outcome)).

A recipe may be required where it stands exactly when `unread` of what
follows its declaration is empty.

| Region | `unread` |
| --- | --- |
| `['ref', t]` | `{}` |
| a literal, another `ref` | `{normal}` |
| `a` then `b`, in evaluation order | `unread(a)` where it lacks `normal`; otherwise `unread(a)` without `normal`, with `unread(b)` |
| test `c`, arms `p` and `q` (`if` value or statement) | `unread(c)` where it lacks `normal`; otherwise `unread(c)` without `normal`, with `unread(p)` and `unread(q)` |
| `c` then a part that can be skipped (`?:` arms, `&&`, `\|\|`, `??`, an optional step and all after it) | as a selection whose other arm is empty: `normal` stays whenever `unread(c)` has it, and the skipped part adds its transfers |
| an operator | the sequence of the operands it always evaluates, then its skippable part |
| `['function', f]` | the sequence of its capture values; the body is not evaluated, and its `return` leaves nothing here |
| a block | the sequence of its statements, then its exit |
| exit `['yield', vs]` | `unread` of the sequence `vs` |
| exit `['return', F, v]`, `['break', L, vs]`, `['continue', L, vs]` | `unread` of the values, with `normal` replaced by the transfer |
| exit `['throw', v]` | `unread(v)` without `normal` |
| a loop `L` (statement or exit) | `unread` of its initial values then its body, with `continue L` dropped and `break L` replaced by `normal` |
| a statement that declares `t` anew, and all after it | every way the rest can end: reads past it are of another binding |
| a lazy definition | nothing: it evaluates nothing where it stands. A read of *its* binding is another `ref` |

Notes on the rows that are not obvious:

- **Sequence.** Once `a` cannot complete normally without a read, nothing
  after it matters: every path that reaches `b` has read. The transfers of
  `a` are kept either way, because a path that left in `a` never reached
  `b`.
- **Throw.** A region that always fails has an empty `unread`. That is the
  rule doing its job: `if (c) { throw e } else { read }` reads on every
  path that completes.
- **Loop.** One pass over the body is enough. A path that reaches
  `continue L` unread starts the body again, where the same facts hold, so
  by induction only the paths to `break L` and to outer transfers count. A
  loop that never breaks contributes no `normal`; see the open question on
  divergence.
- **Rebinding.** Conservative on purpose. It is the reviewer-found defect
  of the first version of `certain`, and the conservative answer costs only
  a refusal.
- **Lazy definitions.** Also conservative: a read of a nested recipe that
  itself certainly reads `t` could count as a read. Not proposed; nothing
  measured needs it.

The three rules `certain` has today are instances: a selection's test or
both arms (the selection row), nothing optional (the skipped-part row),
nothing after a value that can leave (the sequence row keeps the transfer
of `a`). So are the three defects review found in it. The first shape above
falls out: the inner statement's `break L` arm has read `cell` in the test,
so `unread` is empty.

**Shape of the code.** One function from a region to a small set, run on the
`Task` trampoline `certainTask` already uses, since values nest deeply.
`sequence`, `certainOperands`, `certainTask`, `certain` and `leaves` go;
`reached` stays for `localized`. The set is a list of targets: a block names
few of them, so no persistent collection is needed. The operand order has
one owner already, `fjs/js/ast` (`operatorOperands`, `keyOperands`,
`itemOperand`); which operands are skippable is the one new fact, and it
belongs there too, exported, so the join module and
[`demand`](../../../demand/module.f.js) cannot disagree about it.

**Soundness check.** The differential check that found nothing on the
current rule (a block that evaluates successfully before the pass must
evaluate to the same value after it) is the acceptance test for this one,
with loops, `break` and `continue` added to what it generates: it has none
today, and they are where this rule is new. It is a scratch script now; as
a proof it needs a generator written in FunctionalScript, which is its own
task below.

#### 2. A recipe required after a statement, in the arm that goes on

Where one arm of a statement cannot complete normally (`normal` is not
among the ways it can end), what follows the statement runs only after the
other arm. The second shape is that: `cell` is not read on the path that
breaks, and is read on every path through the other arm and what follows.

Proposed: put the recipe at the head of the arm that goes on, required, and
hand it out as one more result of the statement.

```js
['if', [cell], ref(c), { statements: [], exit: ['break', L, []] },
    { statements: [['define', inner, call, 'required'],
                   ['define', a, ['array', [ref(f), ref(inner)]], 'required']],
      exit: ['yield', [ref(inner)]] }]
// exit: ['yield', [ref(cell)]]
```

Conditions, each one a thing the current code can already ask:

- the other arm cannot complete normally;
- neither the test nor that arm reads the recipe, and nothing between the
  declaration and the statement does (`references`);
- `unread` of the arm that goes on, then what follows the statement, is
  empty (rule 1);
- the move crosses no declaration the recipe's inputs name (`shadows`).

The arm that leaves yields nothing for the new result, which is sound
because it never completes; whether FAST and the serializer accept an arm
whose exit is a transfer under a statement with results is the first thing
to check before anything is built.

**Why not fold the continuation into the arm.** That is what the earlier
version of this file proposed, and it is the more general transformation:
the statement becomes the tail of its block. It needs the block's exit
rebuilt for every exit kind, duplicates the exit where it is a transfer,
and changes which block owns every later statement, which every later pass
then sees. The result binding changes one statement and nothing after it.
If a shape turns up that only the fold places, it can be filed with that
input.

### Open questions

1. **Divergence.** A path that loops forever does not complete. Requiring a
   recipe early can turn that path into a failure. The spec's principle
   speaks of paths that complete, and the loop row above follows it. If a
   diverging path must stay diverging, the loop row has to keep `normal`
   for a loop with no provable `break`, and the design otherwise stands.
   This is the language designer's call.
2. **The inner binding.** The sketch uses a second binding, `inner`, so the
   statement's result and the arm's definition do not share an identity.
   The join module creates no bindings today. Either it gains a source of
   fresh ones, or the arm defines `cell` itself and the statement's result
   is the same `cell`; the second needs FAST scoping to allow it.
3. **More than one statement.** With two statements whose arms leave, the
   recipe may belong in the arm of the second, inside the arm of the first.
   Rule 2 applied from the innermost block outward covers it; whether
   `placed` iterates that way is to be checked against the real blocks in
   `compiler/edag`.

### Tasks

- [ ] Export from `fjs/js/ast` which operands of a value can be skipped.
- [ ] Replace `certain` with `unread` (rule 1); restate its proofs, and
      prove the first shape placed with a failing recipe left unmet on a
      path that does not read it.
- [ ] Answer open question 1.
- [ ] Rule 2: the arm that goes on, with the second shape as its proof.
- [ ] The differential check as a proof, loops and transfers included.
- [ ] Compile `fjs/module.f.js` to FunctionalScript, or file what refuses it
      next.

### Related

- [`block-assignment-source-profiles.md`](../../source/todo/block-assignment-source-profiles.md)
  — the same refusal through a member-presence query, and the note on memo
  spellings that grow under repeated conversion.
