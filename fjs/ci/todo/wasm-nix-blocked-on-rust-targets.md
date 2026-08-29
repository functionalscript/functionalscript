## wasm-nix-blocked-on-rust-targets. Migrate the `wasm` job to a generated flake

**Priority:** P3
**Status:** open

Not `blocked`, and not in [`todo/blocked/`](../../../todo/README.md#blocked-by-third-parties),
whatever this file's name suggests. Both are for an issue that cannot progress
until something outside this repository happens, and two of the three paths in
"What has to happen first" are decisions this repository can make today. If both
are ruled out, what is left is purely a wait on Nixpkgs — and then this moves to
`todo/blocked/`, with the Trigger section that requires.

### Problem

The `wasm` job is one of three canonical jobs with no generated flake. It
assembles its toolchain from three actions rather than from the pinned Nixpkgs
snapshot:

- `dtolnay/rust-toolchain` — Rust 1.98.0, `rustfmt` and `clippy`, and the four
  targets `wasm32-wasip1`, `wasm32-wasip2`, `wasm32-unknown-unknown` and
  `wasm32-wasip1-threads`;
- `bytecodealliance/actions/wasmtime/setup` — Wasmtime 48.0.1;
- `wasmerio/setup-wasmer` — Wasmer 7.3.0.

The last two are the runners `.cargo/config.toml` and
`.cargo/config.wasmer.toml` name, so `cargo test --target wasm32-…` invokes them
itself.

### What the snapshot provides

Read from Nixpkgs at the pinned commit
(`062346a6d85bc4b49dfaa61c986e9c5be21217d1`) and, where it differs, from
`master`:

| what the job needs | pinned snapshot | `master` |
|---|---|---|
| `rustc` with `wasm32-wasip1` std | **absent** | **absent** |
| `rustc` with `wasm32-wasip2` std | **absent** | **absent** |
| `rustc` with `wasm32-wasip1-threads` std | **absent** | **absent** |
| `rustc` with `wasm32-unknown-unknown` std | present | present |
| Rust 1.98.0 | 1.95 | 1.97 |
| Wasmtime 48.0.1 | 45.0.2 | 48.0.0 |
| Wasmer 7.3.0 | 7.1.0 | 7.3.0 |

The first three rows are the blocker, and they are not a version gap.
`pkgs/development/compilers/rust/rustc.nix` builds one compiler and names the
targets it builds `std` for:

```nix
# Other targets that don't need any extra dependencies to build.
optionals (!fastCross) [
  "wasm32-unknown-unknown"
  "wasm32v1-none"
  "bpfel-unknown-none"
  "bpfeb-unknown-none"
]
```

plus the host. No WASI target is in that list, on the pin or on `master`, so
three of the job's four targets have no `std` to compile against and every
`cargo test`/`cargo clippy --target wasm32-wasip…` fails at `E0463` before
running anything. `pkgsCross.wasi32` builds a cross compiler for one WASI
target; it is not a toolchain a job can point four targets at.

The other rows would be ordinary bumps if the first three were solved. Wasmtime
45 predates the removal of `wasi-threads` in 47 that
[wasmtime-threads](../../../todo/blocked/wasmtime-threads.md) records, so the
job's Wasmer-only threads target would stop being necessary — correct, but
testing something other than what it tests now.

### Why a partial migration is not the answer

Taking only Wasmtime and Wasmer from a flake and leaving `cargo` to the setup
action does not work: the runners are invoked *by* `cargo`, so `cargo` has to
run inside the shell that has them. Whether `nix develop` leaves the runner's
`PATH` in place or replaces it with the shell's is precisely what this
repository has been careful never to depend on — see
[65Z-ci-nix](65z-ci-nix.md), "Validation and adoption" — and a split job would
depend on it. Either the whole toolchain comes from the flake or none of it
does.

### What has to happen first

Any one of these unblocks it. They are ordered by how little they change:

- **Nixpkgs builds `std` for the WASI targets**, or packages it separately in a
  form a shell can add. Watch the `--target=` list in
  `pkgs/development/compilers/rust/rustc.nix`, not the `rustc` version — a newer
  Rust with the same target list changes nothing here.
- **The job installs its toolchain inside the shell**, from `pkgs.rustup` plus
  an explicit `rustup toolchain install 1.98.0 …`. That is what the setup action
  does today, so it is no less pinned than the status quo, but it puts a network
  install inside a shell whose point is that the snapshot determines its
  contents. Decide deliberately; do not drift into it.
- **[65Z-ci-nix](65z-ci-nix.md)'s "official Nixpkgs" scope is widened** to a
  toolchain overlay flake (`rust-overlay`, `fenix`). That is a scope change to
  that issue, with a second upstream to pin and track, and it should be decided
  there rather than here.

### Tasks

- [ ] Re-check the `--target=` list rather than the Rust version
- [ ] Choose between the three shapes above, and record the choice here
- [ ] If it migrates: declare `wasmNixJob`, add it to `nixJobs`, replace the
      three actions with `nixInstall` and version checks for the three tools, as
      `deno` did
- [ ] Move `wasmtime`, `wasmer` and the Rust version in
      `../config/module.f.mjs` to what the snapshot provides, with the comment
      the `deno` pin has
- [ ] Drop the three actions from the action table once nothing uses them
- [ ] Revisit the Wasmer-only threads target if the Wasmtime it lands on still
      has `wasi-threads`

### Related

- [65Z-ci-nix](65z-ci-nix.md) — the flake generation this job is a holdout from,
  and where the "official Nixpkgs only" scope is decided
- [bun-nix-blocked-on-nixpkgs](bun-nix-blocked-on-nixpkgs.md) — the other
  canonical runtime job Nixpkgs cannot serve yet, blocked for an unrelated
  reason
- [66A-ci-cargo-step-factory](66a-ci-cargo-step-factory.md) — the `cargo` step
  builders this job is assembled from
- [wasmtime-threads](../../../todo/blocked/wasmtime-threads.md) — why the
  threads target runs under Wasmer only
