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

- Replace the in-order walk of `certain` with the question it stands for:
  whether every path from the declaration to an exit of the block, a normal
  one or a transfer, reads the recipe. For a region that is two facts, that
  every path completing it normally reads, and that every path leaving it
  does; a sequence, a selection and a statement with arms combine them. The
  rules `certain` has today, a selection's test or both of its arms, nothing
  after a value that can leave, are cases of it.
- Where one arm of a statement always leaves, what follows the statement
  belongs to the other arm. Carry it there, as a join carries a selection's
  arms into a statement's, and the recipe has its one arm.

### Tasks

- [ ] State the all-paths rule over values, statements, blocks and exits,
      loops included, and replace `certain` with it.
- [ ] Fold a statement's continuation into its one arm that completes.
- [ ] Prove both inputs above placed, with a recipe that fails left unmet on
      every path that does not read it.
- [ ] Compile `fjs/module.f.js` to FunctionalScript, or file what refuses it
      next.

### Related

- [`block-assignment-source-profiles.md`](../../source/todo/block-assignment-source-profiles.md)
  — the same refusal through a member-presence query, and the note on memo
  spellings that grow under repeated conversion.
