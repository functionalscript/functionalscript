# Keep chunk traversal state local to its thunk

**Status:** wip, stacked on #3771.

`unpackChunkList` returns a thunk that reassigns the outer `stack`
parameter. The compiler refuses that mutable capture. Start each thunk
invocation with `let s = stack` and advance `s` instead.

- [ ] Make the traversal state local to the returned thunk.
- [ ] Check compilation and promote accepted dependency-closed modules to
  `.f.js`, updating their references in the same change.
- [ ] Run the scoped proofs and coverage for the change.
