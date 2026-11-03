## Implement the L0 interface in NaNVM

**Priority:** P2
**Status:** wip

### Problem

[L0](../../../doc/sasha-gil/wasm/l0-design.md) is the core of the WASM
runtime interface: about thirty functions over an opaque `any`, imported by
a compiled program from `fjs:l0`. Its FunctionalScript view runs on a
JavaScript host today, with proofs of every function and of every misuse
that traps. NaNVM, the only Rust runtime, has the same operations spread
over `Any`, its containers and `IVm`, under other names and with other
contracts. It does not offer L0 yet, so no program compiled against L0 can
run on it.

### Proposal

Grow L0 in NaNVM in three layers, each a step below, each tested on its
own.

1. **A typed Rust L0, `nanvm_lib::l0`.** One Rust function per L0 function,
   generic over `IVm`, on `Any` and plain Rust types: `u32` indices,
   slices for the bytes, a `Builder` for containers, `Result` for `call`.
   Where WASM traps, it panics with the text the FunctionalScript view
   throws, `l0.<name>: <reason>`, and its tests mirror that view's proofs.
   `dup` and `drop` are `Clone` and `Drop` here.
2. **The ABI over handles.** Every value an `i64`, builders `i32`,
   `dup` and `drop` explicit, the four constants, and `make_string`,
   `read_units`, `make_bigint` and `read_words` over a byte buffer. Still
   native Rust, tested natively.
3. **NaNVM as a `.wasm`.** The ABI exported for the `fjs:l0` imports, with
   the memory, the table, the `fjs.abi` section and `call` through the
   table, loaded by a small host and checked against the FunctionalScript
   view.

Steps 2 and 3 have open questions, each for the task owner before its step
starts:

- **The encoding of `any` for `naive`.** `naive` holds an `Rc` enum, not a
  NaN-boxed word, so the `i64` is a handle, an owned pointer, or the
  values move to [`nanenum`](../src/nanenum.rs) first.
- **`(i32, any)` results.** `call` and every code index return two values.
  Stable Rust's `extern "C"` on `wasm32` returns a pair through memory, and
  a function pointer cannot name a multi-value type, so step 3 needs a thin
  wrapper not written in Rust, or another shape for the status.
- **The loader-owned memory.** Rust's allocator assumes it owns the memory
  above its heap base, where the design has the loader reserve the
  program's regions.
- **A function's text.** L0's `make_function` takes the text as a string
  value; NaNVM's functions hold a `&'static str`.

### Tasks

- [ ] `nanvm_lib::l0`, the typed Rust L0, with tests that mirror
      the FunctionalScript view's proofs.
- [ ] The ABI over handles.
- [ ] NaNVM as a `.wasm` exporting L0.
