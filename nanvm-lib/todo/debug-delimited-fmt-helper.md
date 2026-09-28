## debug-delimited-fmt-helper. `Debug` impls re-open-code `container_fmt`'s delimited loop

**Priority:** P4
**Status:** open

### Problem

`container_fmt.rs` exists precisely to encapsulate "iterate indexed items,
emit a separator between them, wrap in open/close"
(`ContainerFmt::container_fmt` in `nanvm-lib/src/vm/container_fmt.rs`), and
`Array`/`Object` `Debug` use it. But `Debug for BigInt` re-implements the same
delimited iteration instead of reusing it:

```rust
// Debug for BigInt, nanvm-lib/src/vm/bigint/debug.rs — '_'-separated MSB-first hex join
let last = items.length() - 1;
write!(f, "{:X}", items[last])?;
for i in (0..last).rev() {
    write!(f, "_{:016X}", items[i])?;
}
```

The bigint join is the same delimited-iteration concern as `container_fmt`
with two twists: reverse (MSB-first) order and a differently-padded first item
(`{:X}` vs `_{:016X}`).

This issue was filed with a second site, a `,`-separated parameter list in
`Debug for Function`. At `36c8d4a` that impl writes the fixed marker
`[Function]` and iterates nothing, so the bigint join is the only candidate
left.

### Proposal

Generalize `container_fmt`'s core into a delimited-format helper
parameterized by the separator and an index-aware per-item formatter:

```rust
fn fmt_delimited(
    f: &mut Formatter<'_>,
    sep: char,
    len: u32,
    item: impl Fn(&mut Formatter<'_>, u32) -> Result,
) -> Result
```

`ContainerFmt::container_fmt` becomes open + `fmt_delimited(f, ',', len,
|f, i| self[i].fmt(f))` + close. The bigint join can route through it with an
index-aware closure choosing the pad (the iteration order/index mapping stays
at the call site); if that obscures more than it shares, the helper has a
single consumer and this issue is not worth doing — decide with the code in
front of you.

### Tasks

- [ ] Evaluate the bigint join against `container_fmt`; extract
      `fmt_delimited` and route both through it, or record why not.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [159](./159-collapse-per-type-wrapper-traits.md) — lists `ContainerFmt` as an "already-correct abstraction
  to leave alone"; this issue is about the impl that fails to consume it.
