## The error channel in a module of its own

**Priority:** P3
**Status:** open

### Problem

[`src/files.rs`](../src/files.rs) holds three things before its tests:
the error channel — `IoError`, `code`, `raw_code`, `failure` — the pure
path text of `normalize`, and the file operations.

The channel is not the files module's.
[`inflate.rs`](../src/inflate.rs) and [`resolve.rs`](../src/resolve.rs)
both `use crate::files::IoError`, and `resolve.rs` reaches for
`crate::files::failure`, though neither opens a file through it.

The mapping from an `io::Error` is a closure spelled at every call:

```rust
.map_err(|e| failure(&e, "open", path))?;
.map_err(|e| failure(&e, "stat", path))
.map_err(|e| failure(&e, "close", path))
```

at tens of sites in `files.rs` and a few in `resolve.rs`.

### Proposal

`src/error.rs` owns `IoError`, `code`, `raw_code` and `failure`, with
the tests that pin them, and one extension method on
`io::Result<T>`:

```rust
File::open(path).at("open", path)?
```

`lib.rs` re-exports `IoError` from there, so nothing public moves.
`files.rs` loses the channel and its tests, and
[filesystem error codes](./filesystem-error-codes.md), which grows
`raw_code`, gets a file to grow in.

### Drawbacks

- An extension trait on `io::Result` is one more name to learn; a plain
  function would not shorten the call, so it is the trait or nothing.
- A few sites build their `io::Error` from an `ErrorKind` or label a
  failure with something other than a path — `mkdir`, `rmdir`, `rename`,
  the exclusive write — and keep calling `failure`.

### Related

- [the lexical path rules](./lexical-path-module.md), which takes
  `normalize` out of the same file
- [the request reader](./request-reader.md)
