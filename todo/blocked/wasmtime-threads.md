# Restore Wasmtime coverage for multi-threaded WASM

**Priority:** P3
**Status:** blocked

### Problem

Wasmtime 47 removed wasi-threads support (`wasmtime run --wasi threads` is a
hard error), per the
[removal RFC](https://github.com/bytecodealliance/rfcs/blob/main/accepted/wasmtime-remove-wasi-threads.md):
the wasi-threads proposal is architecturally dead-ended, the supporting
`wasi-common` crate was unmaintained, and Wasmtime's shared-memory
implementation was unsound. CI therefore runs the `wasm32-wasip1-threads`
tests under Wasmer only (`.cargo/config.wasmer.toml`); Wasmtime still lints
the target via Clippy, which needs no runner. The runner×target matrix has
lost the Wasmtime×threads cell.

### Trigger

Unblocked when Wasmtime ships runnable multi-threaded WASM support again —
WASIp3 cooperative threading and/or the
[shared-everything-threads](https://github.com/WebAssembly/shared-everything-threads)
proposal — and Rust has a corresponding compilation target. Each path that
ships is a separate runner×target cell; adopt every one that becomes feasible
for maximum coverage, without waiting for the others. Note the restored
coverage will likely use a new target, not `wasm32-wasip1-threads`, which
Wasmtime will not revive.

### Tasks

- [ ] add a Wasmtime runner for the new threads target to `.cargo/config.toml`
- [ ] extend `fjs/ci/rust/module.f.ts` so the threads target runs under
  Wasmtime again (replace `wasmerOnlyTarget` with the full `wasmTarget`
  treatment, or add the new target alongside)

### Related

- [fjs/ci/rust/module.f.ts](../../fjs/ci/rust/module.f.ts) — `wasmerOnlyTarget`
  is the workaround this issue removes
- [.cargo/config.toml](../../.cargo/config.toml) — missing
  `wasm32-wasip1-threads` runner points here
