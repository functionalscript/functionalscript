## ASCII static string

**Priority:** P3
**Status:** wip — the VM reads both forms; the serializer still writes UTF-16

### Problem

A [static string](../src/vm/static_value.rs) was only its UTF-16 code
units, `StaticString(pub &'static [u16])`, and the serializer still writes
every string that way. Most of the strings a compiled module
holds are ASCII: property keys, method names, a function's text. Each of
them takes two bytes per character in the binary, and reads in the generated
Rust as a list of numbers, `utf16(&[104, 105])` for `'hi'`.

A descriptor that holds one byte per code unit halves that data and can be
written as a literal a reader recognizes. It is also the form a packed VM's
short strings start from ([optimal NaNVM](./optimal-nanvm.md) lists a 7-bit
string).

### Proposal

- **`StaticString` is an enum of the two forms.**

  ```rust
  pub enum StaticString {
      Utf16(&'static [u16]),
      /// One code unit per byte. Every byte is below `0x80`.
      Ascii(&'static [u8]),
  }
  ```

  Everything that refers to a `StaticString` takes either form with no
  change of its own: `StaticAny::String`, a `StaticObject`'s keys, a
  `StaticFunction`'s `text`, and `IStaticVm::load_string`, which stays the
  one conversion a VM writes. It is a breaking change to the tuple struct.

  Not taken: a second type, `StaticAsciiString`, beside the first. It
  breaks nothing, and a key or a function text, which name `StaticString`
  and are where ASCII is most common, could not hold one without a third
  type that is this enum under another name.

- **Two helpers write a descriptor.** `utf16(&[0x68, 0xd800])` and
  `ascii("hi")`, `const fn`s beside the type, are what the serializer
  emits and what a hand-written module uses. `ascii` takes a `&'static
  str`, so the text reads as text.

- **Nothing is rechecked when a string is loaded.** Static constants are
  mostly written by the code generator, and a VM does not pay at run time
  to verify what it wrote. A check is made only where it is cheap:
  - `ascii` asserts `is_ascii`. In a `static`'s initializer that is
    evaluated when the module is compiled, and costs nothing when it runs.
  - A byte of `0x80` or above written through the variant directly is not
    checked. It reads as the code unit of the same number, as Latin-1
    would, and the descriptor's contract is what says it is not written.

  Not taken: an `is_ascii` assertion at each load. Also not taken: calling
  the form Latin-1, every byte a code unit up to `0xff`, which has no
  invalid state and gives up the seven bits a packed VM would use.

- **The widened units are never stored, and a unit is read by value.** A
  VM keeps the descriptor and reads through it. An ASCII string holds no
  `u16` to lend, and `SizedIndex` was built on `Index`, which answers a
  reference. So a container's item is read by value first:
  `SizedIndex::item` answers `Output`, not `&Output`, and no longer
  requires `Index`. A string's `u16` and a big integer's `u64` are `Copy`,
  and `String<A>` and `BigInt<A>` lose `s[i]` for `s.item(i)`.

  An array keeps `a[i]`. Its item, `Any<A>`, is not `Copy`, and the
  generated code reads a frame by reference in thousands of places; a
  by-value array is the "item by value" point of
  [static constants](./static-constants.md) and stays there.

  The naive VM's string is its own units or a descriptor. A static
  object's key is compared with a string unit by unit, with nothing built.

  Not taken: a static table of the 128 ASCII code units, out of which a
  byte is lent as a `&u16`. It keeps `Index` and costs a memory read for a
  value already at hand.

- **The serializer.** A string whose units are all below `0x80` is written
  as `ascii("…")`, the rest as `utf16(&[…])`: a literal value, a key and a
  function text alike, since they share one `LITERAL_n`.

### Tasks

One pull request each, stacked, after the one that files this issue.

- [x] `SizedIndex` reads an item by value; `String<A>` and `BigInt<A>`
  are read with `item`.
- [x] `StaticString` as the enum with `utf16` and `ascii`, readable by
  index; the naive VM holding the descriptor; the serializer writing
  `utf16(&[…])` for every string; `npm run gen`.
- [ ] The Rust serializer writes an ASCII string as `ascii("…")`;
  `npm run gen`.

### Related

- [Static constants](./static-constants.md) — the descriptors this adds a
  form to.
- [Optimal NaNVM](./optimal-nanvm.md) — the packed strings an ASCII static
  could load into.
- [String slices](./string-slices.md) — the same line between what the
  traits permit and what the naive VM does.
