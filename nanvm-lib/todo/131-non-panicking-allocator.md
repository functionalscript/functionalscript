## 131. An allocator for `nanvm` that doesn't panic.

**Priority:** P3
**Status:** open

An allocator for `nanvm` that doesn't panic. Instead, it should return `Result<T, Any>`.

### Sites that still abort

`spread_array` reserves through `Vec::try_reserve` and throws the
`RangeError` of an array that cannot be backed
(`vm/unstable/mod.rs`; the test `spread_array_unbacked` is the abort it used to
be: `memory allocation of 103079215080 bytes failed`). The rest of the VM sizes
an allocation from a count a program controls and cannot fail that way, because
the allocation happens inside a container constructor:

- `array/create.rs`'s `create`, which bounds the length at `2³² − 1` and then
  builds the array from an iterator;
- the string builders that call it: `repeat`, `padStart`/`padEnd`, `concat`.

`'a'.repeat(2 ** 32 - 1)` is a count under the limit that the machine may not
back. Making these fallible means a fallible container constructor in `IVm`,
which is this task.
