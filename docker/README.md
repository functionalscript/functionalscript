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

`> _.txt 2>&1` disables TTY and prevent cargo to insert `--diagnostic-width=...`.

Use `SCCACHE_LOG=debug SCCACHE_ERROR_LOG=_.log` to see which parameters are passed to `RUSTC`.

For example,
`SCCACHE_LOG=debug SCCACHE_ERROR_LOG=/_.log cargo test --no-run`

See also https://github.com/mozilla/sccache/issues/2418
