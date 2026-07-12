## debug-delimited-fmt-helper. `Debug` impls re-open-code `container_fmt`'s delimited loop

**Priority:** P4
**Status:** open

### Problem

`container_fmt.rs` exists precisely to encapsulate "iterate indexed items,
emit a separator between them, wrap in open/close"
(`nanvm-lib/src/vm/container_fmt.rs:10-21`), and `Array`/`Object` `Debug` use
it. But two other `Debug` impls re-implement the same delimited iteration
instead of reusing it:

```rust
// nanvm-lib/src/vm/function/debug.rs:11-14 — parameter list, ',' separator
for i in 0..self.length() {
    if i != 0 { f.write_char(',')?; }
    write!(f, "a{i}")?;
}

// nanvm-lib/src/vm/bigint/debug.rs:17-23 — '_'-separated MSB-first hex join
let last = items.length() - 1;
write!(f, "{:X}", items[last])?;
for i in (0..last).rev() {
    write!(f, "_{:016X}", items[i])?;
}
```

The `if i != 0 { write sep }` idiom in `function/debug.rs` is byte-for-byte
the core of `container_fmt`, differing only in the per-item output (`a{i}`
instead of `self[i].fmt(f)`). The bigint join is the same delimited-iteration
concern with two twists: reverse (MSB-first) order and a differently-padded
first item (`{:X}` vs `_{:016X}`).

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
|f, i| self[i].fmt(f))` + close; `function/debug.rs`'s parameter list becomes
`fmt_delimited(f, ',', self.length(), |f, i| write!(f, "a{i}"))`. The bigint
join can route through it with an index-aware closure choosing the pad (the
iteration order/index mapping stays at the call site); if that obscures more
than it shares, scope bigint out and dedup only the two `,`-separated sites —
decide with the code in front of you.

### Tasks

- [ ] Extract `fmt_delimited`; route `ContainerFmt` and `function/debug.rs`
      through it.
- [ ] Evaluate the bigint join; include or document why not.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [159](./159.md) — lists `ContainerFmt` as an "already-correct abstraction
  to leave alone"; this issue is about the two impls that fail to consume it.
