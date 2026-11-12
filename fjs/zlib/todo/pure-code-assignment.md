## Carry Huffman assignment state through folds

**Priority:** P2
**Status:** wip

### Problem

`assign` in `testlib.f.mjs` uses `forEach` to reassign captured `next` and
`codes` bindings and reads a changing outer code length. This prevents the
test helper from compiling as FunctionalScript.

### Proposal

Fold explicit assignment state through code lengths 1 through 15 and through
symbols in their original order. Each step returns the next counter and code
array. Keep the existing canonical Huffman-code spelling and the independent
fixture helper used to check the decoder.

### Tasks

- [ ] Replace captured updates with explicit fold state.
- [ ] Validate existing zlib fixtures and round trips.
- [ ] Promote the helper if it compiles, updating its references and tracker.
