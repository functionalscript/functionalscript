## `isName` materialises a name it could read in one pass

**Priority:** P4
**Status:** open

### Problem

[`isName`](../module.f.mjs) reads its input through `byteArray`, which
materialises the name as a dense `readonly number[]`. That costs eight bytes
of heap per byte of name, because every slot holds a double. Measured on a
20000-byte name, against the same bytes packed in a `bigint`:

| representation | heap at rest |
| --- | --- |
| dense `readonly number[]` | 159.5 KiB |
| `bigint` | 16.3 KiB |

About ten to one, and the array is transient — it lives only for the length
of the call — so this is a rate rather than a leak. A ref name is short, and
nothing here is on a hot path, which is why this is P4 and not a fix in the
branch that wrote it. The shape is also older than that branch: the rules
took an array when they were private to `fjs/git/tag`, and that module was
calling `byteArray` at the call site.

### Why the representation is not the fix

Two obvious substitutions are both worse than they look.

A `bigint` through `fjs/types/bit_vec` is 8x smaller at rest and bounded:
`maxLength` is 1048576 bits, so **128 KiB**, a cap Bun's `bigint` constraint
sets and the module documents as the smallest across the runtimes
FunctionalScript supports. A bit vector cannot hold a payload of arbitrary
size, so it is the right carrier for an object id and the wrong one for a
whole file. Where a large byte string must be held, the shape is a list or an
array of bit vectors rather than one vector.

Building a `bigint` a byte at a time is also a trap: the same 20000 bytes
churn 3550 KiB of garbage that way, since every shift allocates a new value.
`u8ListToVec` uses an absorbing concat fold and does not, which is why the
packed representation is cheap here and expensive written by hand.

A hex string is 2 bytes per byte where the runtime keeps a one-byte string,
so 4x smaller than the array, but it doubles the length and puts the rules a
nibble away from the bytes they are about.

### Proposal

Do not hold the name at all. Every rule is decidable in one forward pass over
the bytes with an accumulator of fixed size:

- the previous byte, for `..` and `@{`;
- a flag for being at the start of a component, for the empty-component and
  leading-`.` rules;
- a five-byte rolling window, for `.lock` at the end of any component;
- the last byte seen, for the trailing `.` rule, which applies to the whole
  name and not to a component.

`fold` in [`fjs/types/list`](../../../types/list/module.f.mjs) is that pass.
Such a version allocates nothing proportional to the name, so the eight-fold
cost goes rather than shrinks, and it reads a `Bytes` and a `Vec` through
`u8List` alike. It also checks each byte as it arrives, which is what
`byteArray` currently buys, so the panic on a value that is no byte survives
the change — see the `throw` cases in [`../proof.f.mjs`](../proof.f.mjs),
which must keep passing.

The rules themselves must not move. They are measured against
`git check-ref-format` on Git 2.43.0 and the proof table is the record; a
rewrite is only correct if that table still passes unchanged, and if deleting
any one rule still reddens it.

### Related

- [`fjs/git/refname`](../module.f.mjs) — `isName`, and why it takes `Bytes`.
- [`fjs/types/bit_vec`](../../../types/bit_vec/module.f.mjs) — `maxLength`,
  and the absorbing fold that makes a packed vector cheap to build.
- [`fjs/ebnf/byte`](../../../ebnf/byte/module.f.mjs) — `byteArray`, the
  materialisation this would remove, and why a hole in a sparse array is
  refused rather than stepped over.
