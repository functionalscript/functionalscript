## Switch oversized-prone callers from `u8ListToVec` to `tryU8ListToVec`

**Priority:** P3
**Status:** open

### Problem

`u8ListToVec` (`fs/types/bit_vec/module.f.ts:491-492`) is `mapUnwrap(tryU8ListToVec(bo))`
— it asserts the result is non-`null` and throws a generic `'assertion
failed'` (from `assert` in `fs/asserts/module.f.ts`) when the input would
exceed `maxLength`. `tryU8ListToVec` returns `Nullable<Vec>` instead, letting
the caller decide how to fail.

Two current call sites use the throwing form on inputs whose size isn't
bounded up front, so they can only fail with that generic, undescriptive
message:

- `fs/types/uint8array/module.f.ts:32-33` — `listToVec(input: List<Uint8Array>)`
  flattens a lazy list of chunks and calls `u8ListToVecMsb` with no prior size
  check, because the total length of a lazy `List<Uint8Array>` isn't known
  until it's walked. Contrast with its sibling `toVec` in the same file
  (`fs/types/uint8array/module.f.ts:23-28`), which pre-checks
  `input.length > maxLengthBytes` and throws a descriptive `"the array is too
  big"` before ever calling `u8ListToVecMsb`. `listToVec` has no equivalent
  guard, so an oversized chunk list just blows up inside `mapUnwrap`'s
  `assert`. Note this whole module is `@deprecated` in favor of `Vec`-native
  APIs, so consider whether to fix in place or let it ride out the
  deprecation.
- `fs/text/module.f.ts:40-41` — `utf8(s: string): Utf8` converts an
  arbitrary-length JS string to a byte vector via the throwing
  `u8ListToVecMsb`, with no bound on `s.length`. A long-enough string raises
  the same generic assertion failure instead of a recoverable error.

### Proposal

For each call site, switch to `tryU8ListToVec` and propagate `Nullable<Vec>`
(or a `Nullable<string>` return for `utf8`) so callers get a clean `null`
instead of a thrown assertion, consistent with how `fs/base64/module.f.ts`'s
`decode` and `fs/base_n/module.f.ts`'s `stringToVec` already surface overflow.
Where a thrown error is still wanted at a given boundary (e.g. `toVec`'s
existing `"the array is too big"` contract), wrap the `null` result in an
explicit, descriptive throw rather than relying on the generic `assert`
message from `mapUnwrap`.

### Tasks

- [ ] `fs/types/uint8array/module.f.ts`: switch `listToVec` to
      `tryU8ListToVecMsb` and decide its public signature (`Nullable<Vec>` vs.
      a descriptive throw matching `toVec`'s style).
- [ ] `fs/text/module.f.ts`: switch `utf8` to `tryU8ListToVec` and decide
      whether `Utf8`/`utf8` becomes `Nullable`, or whether to keep throwing but
      with a descriptive message instead of the generic assertion.
- [ ] Audit any other `u8ListToVec` call sites that appear as the API spreads.
- [ ] Add proof cases for the oversized-input path at each switched call site.

### Related

- `fs/base64/todo/decode-rejects-max-size-input.md` — sibling overflow-handling
  gap in the `base_n`/`base64` codec stack.
