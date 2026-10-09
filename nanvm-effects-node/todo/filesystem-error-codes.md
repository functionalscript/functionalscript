## Complete native filesystem error-code parity

**Priority:** P2
**Status:** open

### Problem

`failure` in [`files.rs`](../src/files.rs) used to retain only six broad
`std::io::ErrorKind` names. A self-referential symlink therefore lost `ELOOP`,
which changes the answer of the Node layer's `leadsNowhere` predicate.

PR #2655 now preserves the reported `ELOOP`, `EROFS`, `ENOSPC` and `EMFILE`
cases on the native Linux CI targets, macOS and Windows. It also preserves
`EPERM` instead of collapsing it into `EACCES`, `EIO`, and Unix `ENFILE`.
`EROFS` and `ENOSPC` also have portable `ErrorKind` fallbacks. Raw codes are
looked up before the broad kind, without adding a dependency or using the
unstable `ErrorKind::FilesystemLoop` variant.

This is a focused fix, not an exhaustive translation. For example, on Linux
x86_64, `failure(&std::io::Error::from_raw_os_error(37), "open", "p")` still
omits `ENOLCK`; WASI and other ABIs lack the raw-code table, so a symlink loop
there can still lose its code. The operation remains an `ioError`, with the
host error and numeric code in its message, not a successful result, but
programs branching on `code` can differ from the Node runner.

### Follow-up

Preserve the symbolic host code for every supported filesystem error and
supported target, using the Node runner's observable contract. Decide whether
an existing platform library or a maintained translation is the simplest
source of truth; do not extend a Linux numeric table to unrelated ABIs.
Include differential tests for errors that share an `ErrorKind`, uncommon
filesystem errors, Windows operation-specific translations, and WASI.
Unknown/custom errors must remain errors, without an invented POSIX name.
This is part of the [overall native parity task](../../todo/nanvm-effects-node-operations.md).

### Sources

- Linux numeric ABI: [`errno-base.h`](https://github.com/torvalds/linux/blob/master/include/uapi/asm-generic/errno-base.h) and [`errno.h`](https://github.com/torvalds/linux/blob/master/include/uapi/asm-generic/errno.h).
- Darwin numeric ABI: [`bsd/sys/errno.h`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/errno.h).
- Windows names: [system error codes](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes); Node translation: [`libuv/src/win/error.c`](https://github.com/libuv/libuv/blob/v1.x/src/win/error.c).
