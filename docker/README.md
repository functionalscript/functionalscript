# Dockerfile

## Build

Run the command from the repo root.

```sh
docker build -t functionalscript ./docker
```

## Run

```sh
docker run -it functionalscript
```

Or clean version w/o network:

```sh
docker run --rm -it --network none functionalscript
```

## Container Commands

- `cargo test`
- `npm test`
- `deno task test`
- `bun ./dev/test/module.ts`

## Sccache

To use sccache in a terminal, use `cargo test --no-run > _.txt 2>&1` or
`cargo test --no-run > >(tee _.txt) 2>&1`.

This `> _.txt 2>&1` output redirection disables TTY and prevent cargo to insert `--diagnostic-width=...`.
See https://github.com/mozilla/sccache/issues/2418 for more details.

`sccache -

Use `SCCACHE_LOG=debug SCCACHE_ERROR_LOG=_.log` to see which parameters are passed to `RUSTC`.

For example,
`SCCACHE_LOG=debug SCCACHE_ERROR_LOG=/_.log cargo test --no-run`

## Codex Setup

```sh
rustup component add clippy
rustup component add rustfmt

# Install Node.js dependencies.
npm ci

# Install Rust dependencies.
cargo fetch

rustup show
node -v
```
