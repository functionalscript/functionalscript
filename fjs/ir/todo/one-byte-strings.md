## Long strings of 8-bit units, as an experiment

**Priority:** P3
**Status:** open

### Problem

A long string in the IR heap is a 32-bit length and then its UTF-16 units,
two bytes each
([long-strings.md, choice 4](../../../doc/sasha-gil/ir/long-strings.md#4-a-long-strings-block)).
A string whose every unit is below 256, as ASCII and Latin-1 text are,
then spends half of its block on zero bytes, and `concat`, `substring` and
each copy move twice the bytes that it needs. V8 keeps such strings in one
byte per unit, as its one-byte strings.

### Proposal

A String variant of its own in the IR, as the line heap is a Heap variant
of its own ([line-heap.md](./line-heap.md)), as an experiment (the owner,
2026-11-27): option C of long-strings.md's choice 4. It keeps two forms
behind the same String functions, named by the low nibble of the block's
type `t`: form 0, A's 16-bit units, and form 1, one byte per unit, which
it writes wherever every unit of a new string fits a byte. Each reader of
units then tests the form, and NaNVM's `make_string` takes 16-bit units,
so a string of form 1 crosses into NaNVM by a widening copy. The variant
is linked in place of A's for the experiment, as Any's `checkedKind` is
picked ([#4144](https://github.com/functionalscript/functionalscript/pull/4144)),
and measured against it. It starts after H3d, once A's long strings are
linked and measured ([heap.md](./heap.md)).

### Tasks

- [ ] A note: when `concat` and `substring` write form 1, how `length` and
      `unit` read it, and how a string of form 1 crosses into NaNVM
- [ ] The variant beside A's String path, with A's proofs: the
      FunctionalScript model of strings on both arenas, and every program
      proof on both hosts
- [ ] Measured against A's on memory and on speed, with the widening copy
      at each crossing counted, on `repeat`, `shortOps` and the benchmark
      of containers of long strings that H3d adds; the result decides
      whether the variant stays

### Related

- [long-strings.md](../../../doc/sasha-gil/ir/long-strings.md): the block
  that this variant changes, and option C of its choice 4
- [heap.md](./heap.md): H3, whose String path this variant takes the place
  of for the experiment
- [short-strings.md](./short-strings.md): String's variants, which this one
  joins
- [line-heap.md](./line-heap.md): the Heap's experiment, whose form this
  one follows
