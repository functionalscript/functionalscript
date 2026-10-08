## surrogate-path-identity. Model aliases introduced by Node path encoding

**Priority:** P3
**Status:** open

### Problem

Node's UTF-8 path conversion replaces a lone UTF-16 surrogate with U+FFFD.
A write to `\uD800` therefore creates a name returned as `\uFFFD` by `readdir`;
`\uD800`, `\uDC00` and `\uFFFD` can refer to the same host file. A virtual
`Dir` instead stores these as distinct JavaScript keys.

The [name comparator](../readdir/module.f.mjs) now uses the host's replacement
rule for ordering, rather than the text codec's lossless malformed encoding.
It does not change fixture keys or make filesystem operations resolve aliases.
This pre-existing identity mismatch needs one policy across the virtual host;
renaming only the returned `Dirent` would make it disagree with lookup, and
silently merging entries could discard different fixture contents.

### Task

Choose consistent admission and lookup semantics for malformed path strings:
either model host aliases throughout the filesystem or explicitly refuse them.
Cover writes, reads, rename and listing, including a fixture containing distinct
`\uD800` and `\uFFFD` keys. Do not change the general-purpose lossless text codec.
