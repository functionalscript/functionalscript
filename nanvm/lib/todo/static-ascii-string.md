## ASCII static string

**Priority:** P3
**Status:** wip — the design is open; no code yet

### Problem

A [static string](../src/vm/static_value.rs) is its UTF-16 code units,
`StaticString(pub &'static [u16])`. Most of the strings a compiled module
holds are ASCII: property keys, method names, a function's text. Each of
them takes two bytes per character in the binary, and reads in the generated
Rust as a list of numbers, `StaticString(&[104, 105])` for `'hi'`.

A descriptor that holds one byte per code unit halves that data and can be
written as a literal a reader recognizes, `b"hi"`. It is also the form a
packed VM's short strings start from
([optimal NaNVM](./optimal-nanvm.md) lists a 7-bit string).

### Proposal

Nothing here is settled; each point names the option this issue would take
and the ones it would not.

- **The descriptor's shape.** `StaticString` becomes an enum of the two
  forms:

  ```rust
  pub enum StaticString {
      Utf16(&'static [u16]),
      /// One code unit per byte. Every byte is below `0x80`.
      Ascii(&'static [u8]),
  }
  ```

  Everything that refers to a `StaticString` then takes either form with no
  change of its own: `StaticAny::String`, a `StaticObject`'s keys, a
  `StaticFunction`'s `text`, and `IStaticVm::load_string`, which stays the
  one conversion a VM writes. It is a breaking change to the tuple struct:
  the Rust serializer's `StaticString(` becomes `StaticString::Utf16(`, its
  proofs and the generated files follow.

  Not taken: a second type, `StaticAsciiString`, beside the first, with its
  own `StaticAny` variant and its own `load_ascii_string`. It breaks
  nothing, and it leaves keys and function text, where ASCII is most
  common, as UTF-16 unless each of those becomes a choice of two as well.

- **Bytes or `str`.** `&'static [u8]`, written `b"hi"`: a byte string
  literal refuses a non-ASCII character when it is compiled, and only an
  escape, `b"\xff"`, can break the invariant. `&'static str` reads the same
  and refuses nothing.

- **A byte that is not ASCII.** The type cannot rule it out, so a VM
  refuses it: the naive VM panics when it loads one
  ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

  Not taken: a `const fn` constructor that asserts `is_ascii`, which turns
  the panic into a compile error for a `static` and needs the field hidden
  from the VMs that have to read it. Also not taken: calling the form
  Latin-1, every byte a code unit up to `0xff`, which has no invalid state
  and gives up the seven bits a packed VM would use.

- **The naive VM.** Its string is a container of `u16`, and it lends a
  slice of them. An ASCII static is widened into the VM's own container the
  first time its units are read, through the `Projected` items a static
  array already uses, so loading stays free of a walk and `IContainer` stays
  as it is. Keeping the bytes unwidened would change what a string's items
  are for every operation, which is a faster VM's choice and not this
  issue's ([string slices](./string-slices.md) says the same of sharing).

- **The serializer.** A string literal whose units are all below `0x80` is
  written as `StaticString::Ascii(b"…")`, the rest as `Utf16`. It is a
  second step, after the VM loads both forms.

### Tasks

- [ ] Settle the points above.
- [ ] `StaticString` as the enum, the naive VM loading both forms, and the
  serializer writing `StaticString::Utf16(` where it wrote `StaticString(`;
  `npm run gen`.
- [ ] The Rust serializer writes an ASCII literal as `StaticString::Ascii`;
  `npm run gen`.

### Related

- [Static constants](./static-constants.md) — the descriptors this adds a
  form to.
- [Optimal NaNVM](./optimal-nanvm.md) — the packed strings an ASCII static
  could load into.
- [String slices](./string-slices.md) — the same line between what the
  traits permit and what the naive VM does.
