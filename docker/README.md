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
- `bun test`

See [AGENTS.md §1.4](../AGENTS.md#14-ways-to-run-the-functionalscript-test-suite)
for the full list of equivalent ways to run the FunctionalScript test suite.

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
