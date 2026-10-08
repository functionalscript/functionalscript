# Portable directory order

The Node and virtual `readdir` effects return the same deterministic order:
entries of the read root first, then entries of each subdirectory breadth-first.
Each directory's names use lexicographic host-path UTF-8 byte order. A shorter
prefix sorts first; lone UTF-16 surrogates are compared as U+FFFD.

This is an effect-layer contract, not a promise about raw `fs.readdir` output.
Windows libuv retains filesystem enumeration order, while POSIX scans sort names;
recursive traversal also differs between Node versions. The original Node 22
`readdirSync` example and the pinned Node 26 traversal motivated the virtual walk,
but native output must be normalized too for that walk to be portable.

The Node adapter calls `_orderDirents` on native entries **before** normalizing
returned parent paths. Its component callback uses `node:path.relative` from the
read root and splits on the host's `sep`; the root itself has no components.
On POSIX, `a\b` stays one component, distinct from the two in `a/b`, and a literal
`a\..\c` does not collapse. Reconstructing components from normalized output
would lose that distinction and put entries at the wrong breadth-first depth.
The helper orders by parent depth, then by parent components, then entry name.
Comparing components matters: all of `a`
precedes all of `a!`, even though a whole-path comparison puts `a!/x` before `a/x`.
The virtual runner builds that order directly with its queue and `_compareNames`.
The helpers are shared pure code; importing them does not import the virtual
filesystem interpreter into the Node adapter.

Only order is normalized. The native adapter still performs the same read with
the same options and retains all returned entries, names, flags and host errors.
It neither changes link traversal nor merges names. The separate virtual
[filename-identity issue](../todo/surrogate-path-identity.md) and
[filename-length issue](../todo/no-name-length-limit.md) remain out of scope.

`proof.f.mjs` includes deliberately shuffled input, recursive component-prefix
and Unicode cases, read-root forms, and entry-preservation checks. `proof.mjs`
compares real Node and virtual effects on the same portable tree on every OS.
A separate POSIX-only fixture covers literal backslashes alongside actual nested
directories, including a backslash in the read root. Temporary directories are
removed in `finally`. This change preserves the existing returned `parentPath`
normalization; it no longer uses that potentially lossy spelling as a sort key.

Source of the platform distinction: Node v26.10.0's
[Windows scan](https://github.com/nodejs/node/blob/v26.10.0/deps/uv/src/win/fs.c)
and [POSIX scan](https://github.com/nodejs/node/blob/v26.10.0/deps/uv/src/unix/fs.c).
