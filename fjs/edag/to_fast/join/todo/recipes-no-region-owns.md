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
it, or where it stands when nothing after its declaration ends without
having read it ([`unread`](../module.f.js)). One shape fits none of them. It
is written here as the FAST the pass receives, with `cell` the recipe, `c` a
binding and `L` a loop the block is inside.

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

#### A recipe required after a statement, in the arm that goes on

Where one arm of a statement cannot complete normally (`normal` is not
among the ways it can end), what follows the statement runs only after the
other arm. The shape above is that: `cell` is not read on the path that
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
  empty;
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

1. **Divergence.** A path that loops forever does not complete, and
   requiring a recipe early can turn it into a failure. `unread` is
   conservative about it: a `continue` reached unread is a way of its own
   that no later read answers, so a loop is read on every path only when
   each pass reads before it can go round again. The spec's principle
   speaks of paths that complete; if a diverging path may become a failing
   one, a `continue` to the loop can be dropped at that loop, and by
   induction over passes only the paths to a `break` count. This is the
   language designer's call.
2. **The inner binding.** The sketch uses a second binding, `inner`, so the
   statement's result and the arm's definition do not share an identity.
   The join module creates no bindings today. Either it gains a source of
   fresh ones, or the arm defines `cell` itself and the statement's result
   is the same `cell`; the second needs FAST scoping to allow it.
3. **More than one statement.** With two statements whose arms leave, the
   recipe may belong in the arm of the second, inside the arm of the first.
   The rule applied from the innermost block outward covers it; whether
   `placed` iterates that way is to be checked against the real blocks in
   `compiler/edag`.

### Tasks

- [ ] Answer open question 1.
- [ ] The arm that goes on, with the shape above as its proof.
- [ ] The differential check as a proof: a block that evaluates successfully
      before the pass evaluates to the same value after it, over generated
      blocks with selections, loops and transfers. It is a scratch script so
      far; a proof needs its generator written in FunctionalScript.
- [ ] Compile `fjs/module.f.js` to FunctionalScript, or file what refuses it
      next.

### Related

- [`block-assignment-source-profiles.md`](../../source/todo/block-assignment-source-profiles.md)
  — the same refusal through a member-presence query, and the note on memo
  spellings that grow under repeated conversion.
