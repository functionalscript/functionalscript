## The lexical path rules in one place

**Priority:** P3
**Status:** open

### Problem

Two loops reduce dot segments. `normalize` in
[`src/files.rs`](../src/files.rs):

```rust
".." => match segments.last() {
    Some(&last) if last != ".." => { segments.pop(); }
    _ if root.is_empty() => segments.push(".."),
    _ => {}
},
```

and `decode_specifier` in [`src/resolve.rs`](../src/resolve.rs):

```rust
Kind::Up => match kept.last() {
    None if rooted => {}
    Some(&last) if last != ".." => { kept.pop(); }
    _ => kept.push(".."),
},
```

They are the same rule — a `..` pops, stays where there is nothing to
pop and no root, and vanishes at a root — written with the arms in a
different order. What differs is how a segment is classified: `normalize`
skips `""` and `"."`; `decode_specifier` keeps `""` and knows the `%2e`
spellings. A correction to what `..` does at a root is two edits, and
nothing fails on one.

The test for a drive-letter root is written at each of: in `normalize`
(`is_ascii_alphabetic`, `:`, `/`), in `windows_path` with a backslash,
and in `file_url_to_path` offset by the leading slash. And
`if cfg!(windows) { windows_path(&x).map(str::to_string) } else { Ok(x) }`
is verbatim in `absolute_path` and in `real_path`.

### Proposal

`src/path.rs` takes `normalize` out of `files.rs` and holds:

- `reduce(segments, rooted)`, the one reducer over `(Kind, &str)`, with
  `Kind { Skip, Up, Keep }` beside it; `normalize` and `decode_specifier`
  each supply a classifier;
- `drive_root(bytes, separator)`;
- in `resolve.rs`, one `local(path)` for the `cfg!(windows)` guard.

`lib.rs` keeps exporting `normalize`.

### Drawbacks

- The two loops mirror two FunctionalScript sources, `fjs/path`'s
  `normalize` and `fjs/path/import`'s `decode`, as their comments say.
  One Rust reducer for two FunctionalScript ones loosens that
  line-for-line reading. If the FunctionalScript side shares a reducer
  first, this follows it rather than leading.
- [node_modules resolution](../../../todo/node-modules-resolution.md)
  plans to generate the native resolver, which would replace the
  `resolve.rs` half; and
  [file URL authorities](./local-file-url-authorities.md) and
  [UNC identities](./unc-module-identities.md) change the drive
  handling. A shared predicate helps both, but the order matters.

### Related

- [the error channel](./error-channel-module.md)
