## ASCII static string

**Priority:** P3
**Status:** wip — the design is settled but for the points under To decide; no code yet

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

- **A second descriptor, beside the first.** `StaticString` stays as it is.

  ```rust
  /// One code unit per byte. Every byte is below `0x80`.
  pub struct StaticAsciiString(pub &'static [u8]);
  ```

  `StaticAny` gains a variant for it, `AsciiString(&'static
  StaticAsciiString)`, and `IStaticVm` a conversion, `load_ascii_string`,
  answering the VM's `InternalString`; `String::from_static_ascii` is its
  `String<A>` form. Nothing that exists changes, so the serializer, its
  proofs and the generated files stay valid.

  A `StaticObject`'s keys and a `StaticFunction`'s `text` name
  `StaticString` and stay UTF-16. Giving them the choice is a later step
  with its own design, not this issue's.

  Not taken: `StaticString` as an enum of the two forms, which gives keys
  and function text ASCII through the one `load_string` and breaks the
  tuple struct for the serializer and every generated file.

- **Bytes, not `str`.** `&'static [u8]`, written `b"hi"`: a byte string
  literal refuses a non-ASCII character when it is compiled, and only an
  escape, `b"\xff"`, can break the invariant. `&'static str` reads the same
  and refuses nothing.

- **A byte that is not ASCII panics on load.** The type cannot rule it out,
  so a VM refuses it: the naive VM asserts `is_ascii` when it loads one
  ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

  Not taken: a `const fn` constructor that asserts, which turns the panic
  into a compile error for a `static` and needs the field hidden from the
  VMs that have to read it. Also not taken: calling the form Latin-1, every
  byte a code unit up to `0xff`, which has no invalid state and gives up
  the seven bits a packed VM would use.

- **The naive VM.** Its string is a container of `u16`, and it lends a
  slice of them. An ASCII static is widened into the VM's own container the
  first time its units are read, through the `Projected` items a static
  array already uses, so loading stays free of a walk and `IContainer` stays
  as it is. Keeping the bytes unwidened would change what a string's items
  are for every operation, which is a faster VM's choice and not this
  issue's ([string slices](./string-slices.md) says the same of sharing).

- **The serializer.** A string literal value whose units are all below
  `0x80` is written as a `StaticAsciiString(b"…")` and referred to as
  `StaticAny::AsciiString`; the rest, and every key and function text, as
  `StaticString`. It is a second pull request, stacked on the VM's.

### To decide

- The names: `StaticAsciiString`, `StaticAny::AsciiString`,
  `IStaticVm::load_ascii_string`, `String::from_static_ascii`.
- The serializer shares one `LITERAL_n` descriptor between a literal value,
  a property key and a runtime lookup of the same text. A key has to be a
  `StaticString`, so an ASCII text used both ways is either written once as
  UTF-16, or twice, once in each form. This issue would write it once, as
  UTF-16, and use the ASCII form only for a text no key or function text
  needs.

### Tasks

- [ ] `StaticAsciiString`, `StaticAny::AsciiString`,
  `IStaticVm::load_ascii_string` and the naive VM's implementation, with
  the panic on a byte of `0x80` or above.
- [ ] The Rust serializer writes an ASCII string literal value as a
  `StaticAsciiString`; `npm run gen`.

### Related

- [Static constants](./static-constants.md) — the descriptors this adds a
  form to.
- [Optimal NaNVM](./optimal-nanvm.md) — the packed strings an ASCII static
  could load into.
- [String slices](./string-slices.md) — the same line between what the
  traits permit and what the naive VM does.
