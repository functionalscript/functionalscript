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
