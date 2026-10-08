## Refuse unsafe write offsets consistently across runners

**Priority:** P2
**Status:** open

### Evidence

While addressing PR #2655, a standalone experiment on Linux with Node v22.16.0
showed that `FileHandle.write(buffer, 0, 1, 9_007_199_254_740_992)` succeeded
rather than returning `ERR_OUT_OF_RANGE`. It wrote at the descriptor's current
cursor, not at the requested offset. A second write at
`Number(2n ** 64n - 1n)` also succeeded and advanced that cursor. Starting with
one byte `42` written positionally at zero, those calls left `[7, 7]`, size 2.
The temporary file was removed after the experiment.

This is evidence about that Node version's buffer-write API, not a run of the
repository suite or a measurement of its pinned Node versions. The
[`writeBytes` handler](../module.mjs) passes `offset + written` to that API;
the [effect constructor](../module.f.mjs) checks whole-byte data, not the offset.
The shared `maxOffset` is `Number.MAX_SAFE_INTEGER`, but an explicit check is
needed rather than assuming every host write enforces it.

The native `write_bytes` now refuses offsets above that bound before opening
the path. Its stricter refusal must not be described as measured parity with
Node v22.16.0's existing write behavior.

### Follow-up

Reproduce through the actual Node and virtual runners, at the versions in CI.
Refuse non-finite, fractional, negative and unsafe offsets before any write;
reuse `maxOffset` and the existing refusal vocabulary where applicable.
Specify and test the ordering of offset validation versus opening a missing
path, as well as a write whose end crosses the positional limit. Verify that
refusals leave file contents and descriptor position unchanged. Cover the
numeric boundary without creating huge sparse files.
