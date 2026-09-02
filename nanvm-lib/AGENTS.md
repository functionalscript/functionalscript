# Rust (`nanvm-lib/`)

Rules for the Rust crate — NaNVM, the native FunctionalScript VM.
Repository-wide rules live in the root [AGENTS.md](../AGENTS.md), and the design
principles both code bases follow live in [DESIGN.md](../doc/DESIGN.md).

## Contents

1. [Commands](#1-commands)
2. [Coding style](#2-coding-style)

---

## 1. Commands

```bash
cargo fetch              # install dependencies
cargo test               # test the nanvm-lib crate
cargo clippy             # lint
cargo fmt -- --check     # verify formatting
```

Run all three checks before submitting any change that touches Rust.

## 2. Coding style

### 2.1 Avoid `macro_rules!`

Avoid `macro_rules!` in Rust code. Declarative macros hide types from
rust-analyzer, break grep and jump-to-definition, and encourage "invisible code"
that contradicts FunctionalScript's preference for explicit, locally-readable
values. When per-type trait boilerplate looks like a macro candidate (e.g. one
impl block per nominal newtype, byte-identical modulo names), prefer in this
order:

1. a sealed helper trait carrying the variant choice with one-line per-type impls
   and a single blanket `impl<T: Trait>` deriving the boilerplate;
2. a `build.rs` code generator driven from a small source-of-truth table written
   in plain Rust (or a FunctionalScript module if the same table drives other
   artifacts too);
3. accept the hand-written duplication as the cost of readability.

Reach for `macro_rules!` only when no other option is materially better for
readers.
