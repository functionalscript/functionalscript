## Decide the Wasmtime×threads cell while the pin still supports it

**Priority:** P4
**Status:** open

### Problem

CI runs the `wasm32-wasip1-threads` tests under Wasmer only: `wasmerOnlyTarget`
in [`../rust/module.f.mjs`](../rust/module.f.mjs) takes the target out of the
Wasmtime runs, because Wasmtime 47 removed wasi-threads. But the Wasmtime CI
runs is the one `wasmtime` in [`../config/module.f.mjs`](../config/module.f.mjs)
pins — 45.0.2 at `36c8d4a` — which still runs wasi-threads. The cell was
dropped ahead of the Nixpkgs snapshot reaching 47, not forced by today's pin,
so the coverage it gave is available now and nothing tracks whether to take
it.

The long-term restoration, a new threads target Wasmtime supports again, is
blocked on third parties and lives in
[wasmtime-threads](../../../todo/blocked/wasmtime-threads.md). This issue is
only the interval until the pin reaches 47.

### Tasks

- [ ] Decide: restore the cell until the snapshot bump, or keep it dropped
      and say why in `wasmerOnlyTarget`'s JSDoc.
- [ ] If restored: run `wasm32-wasip1-threads` under Wasmtime again, with a
      runner in `.cargo/config.toml`, and make the snapshot bump that brings
      Wasmtime 47 drop it again in the same change.

### Related

- [wasmtime-threads](../../../todo/blocked/wasmtime-threads.md) — the
  restoration that waits on a new threads target.
