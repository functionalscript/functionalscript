# Contributing to FunctionalScript

Check the [./issues/README.md](./issues/README.md) file for existing issues.

## Requirements

- [Node.JS](https://nodejs.org/en/download), version **24** or later is required for development.
- [Rust](https://www.rust-lang.org/tools/install).

### Installing Dependencies

```bash
npm ci
cargo fetch
```

### Running Tests

```bash
npm test
cargo test
cargo clippy
cargo fmt -- --check
```

Feel free to open [issues](https://github.com/functionalscript/functionalscript/issues).

## Codex Environment

Set Node version to 22. We will switch to 24 as soon as it available in Codex.

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
