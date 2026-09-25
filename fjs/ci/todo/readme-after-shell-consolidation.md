## CI docs predate the shared shell

**Priority:** P3
**Status:** open

### Problem

The per-job Deno, Bun and WASM flakes and the `dev` job were folded into one
shared shell, [`nix/flake.nix`](../../../nix/flake.nix), which every job but
Node 22, Node 24, the two Windows jobs and `package-check` enters through
`./nix/run`. [`fjs/ci/README.md`](../README.md) and the comments in
[`config/module.f.mjs`](../config/module.f.mjs) still describe the layout
from before that.

In the README:

- **A `dev` CI job.** The Files list says of `dev/module.f.mjs`: "The `dev` CI
  job enters it and asserts every version". [`module.f.mjs`](../module.f.mjs)'s
  comment on `canonicalJobs` says "There is no `dev` job any more", and the
  generated `ci.yml` has none.
- **A `denoNixJob`.** "`nodeNixJobs` in `node/module.f.mjs`, `denoNixJob` in
  its own module". No `denoNixJob` exists; `nixJobs` is `nodeNixJobs` plus
  `devNixJob`.
- **Deno and Bun flakes.** `deno/module.f.mjs` and `bun/module.f.mjs` are each
  described as "the job's steps and its flake declaration". Both jobs run
  `./nix/run deno …` and `./nix/run bun …` in the shared shell, which carries
  the overridden Bun itself.
- **"The `wasm` job's flake"** with a second input — that input,
  `rust-overlay`, belongs to the shared shell.
- **The version-check example** shows `"v26.8.1"`; `config/module.f.mjs`'s
  `node.default` is `26.8.2`.
- **A missing section.** "see "Generated flake locks" below" — the README has
  no such section; the heading is in [65z-ci-nix](./65z-ci-nix.md).
- **Usage step 3** says to commit `nix/*/flake.nix`. The shared flake is
  `nix/flake.nix`, and the generator also writes each `run` script and
  `nix/lock-update.sh`.

In `config/module.f.mjs`'s comments:

- Above `rustOverlay`: "The `wasm` job is not on a flake", citing
  `../todo/wasm-nix-blocked-on-rust-targets.md`, which does not exist; the
  comment that follows, and `nix/flake.nix`, give the shell `rust-overlay`,
  `pkgs.wasmtime` and `pkgs.wasmer`.
- In the same comment, "Wasmtime and Wasmer are installed by their own setup
  actions" — the `wasm` job takes both from that shell, and the comment above
  `wasmtime` says so.
- Above `typescript`: "The two shells that carry it" — only the shared shell
  carries `typescript-go`; the Node 22 and Node 24 flakes carry only Node.
- Above `bun`: "the `bun` job's flake keeps the snapshot's packaging" — the
  override lives in the shared shell.

### Tasks

- [ ] Rewrite the README's Files entries for `dev`, `deno` and `bun` around
      the shared shell, and drop the `dev` job
- [ ] Replace `denoNixJob` with `devNixJob` in "Generated Nix environments",
      and give `rust-overlay` to the shared shell rather than to `wasm`
- [ ] Take the example versions from `config/module.f.mjs`
- [ ] Point "Generated flake locks" at [65z-ci-nix](./65z-ci-nix.md), or
      drop the reference
- [ ] Correct the paths in Usage step 3
- [ ] Correct or delete the four stale comments in `config/module.f.mjs`,
      including the reference to the missing todo

### Related

- [65z-ci-nix](./65z-ci-nix.md) — the migration that consolidated the shells
