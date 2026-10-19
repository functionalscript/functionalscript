## `IoError` is built by private helpers and inline literals

**Priority:** P5
**Status:** open

### Problem

`files.rs` has `fn refusal(code: &str, message: String)`, `resolve.rs` has
`fn refusal(code: Option<&str>, message: &str)` with a different signature,
and `read_file`, `read_bounded` and `check_window` in `files.rs` write
`IoError { code: None, message }` inline. `inflate.rs` builds the coded
refusal a third way: `From<Fail>` matches each `Fail` to a code and a
message and writes the literal, and the trailing-bytes refusal in `inflate`
writes it again; `native.rs` writes the literal too. `files.rs` also builds
`Stat { size, is_file, is_directory }` from a `Metadata` identically in
`stat` and `fstat`.

### Proposal

Two constructors on `IoError` in `files.rs` — `refusal(code, message)` and
`message(message)` — replacing both helpers and every literal, the
inflater's `From<Fail>` and trailing-bytes refusal and `native.rs`'s among
them; `From<fs::Metadata> for Stat` for `stat` and `fstat`. `failure` stays
the one `io::Error` translator.

### Tasks

- [ ] `IoError::refusal` and `IoError::message`; the helpers and the literals
      in `files.rs`, `resolve.rs`, `inflate.rs` and `native.rs` go.
- [ ] `From<fs::Metadata> for Stat`.

### Related

- [filesystem-error-codes](./filesystem-error-codes.md) — which codes are
  translated; this is how the value is built.
