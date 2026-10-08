## Refuse oversized UTF-8 input in hash demos

**Priority:** P3
**Status:** open

### Problem

A bit vector holds at most `maxLengthBytes` (131,072) bytes, the bigint
`maxLength` of `0x100000n` bits. `utf8` in `fjs/text/module.f.mjs` is
`mapUnwrap(tryUtf8)`: past that size `tryUtf8` answers `null` and `utf8`
throws "assertion failed".

Several demos pass what the reader typed straight to `utf8`:

- SHA-1 and SHA-2, through `digestOf` in
  [`../hash/module.f.mjs`](../hash/module.f.mjs);
- HMAC, through `hmacAlgorithm` in `fjs/crypto/hmac/demo.f.mjs`, for both the
  key and the message;
- PoW, through `tried` and `output` in `fjs/crypto/pow/demo.f.mjs`.

One byte past the limit, the runtime's `fail` replaces the whole demo with
`demo failed: assertion failed`. The input fields go with it, so the reader
cannot shorten the text and has to reload. Checked in headless Chromium at
`33888c887` (the VDF demo branch, which carries `main` at `4d037cd2c`): every
field above works at exactly the limit and fails one byte over.

That is a crash where [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
asks for a refusal.

### Proposal

Use `tryUtf8` and refuse oversized input in the view, as the bits demo
(`../bits/module.f.mjs`) and the VDF demo (`fjs/crypto/vdf/demo.f.mjs`, in
functionalscript/functionalscript#2651)
already do: `text too long: more than 131072 UTF-8 bytes`. `digestOf` covers
SHA-1 and SHA-2 at once; HMAC and PoW each need their own call sites changed.
Each demo's proof pins the refusal one byte past the limit.

### Tasks

- [ ] `digestOf` and `hashOutput`: refuse instead of throwing
- [ ] HMAC: refuse an oversized key or message
- [ ] PoW: refuse an oversized input with its nonce appended
- [ ] proofs for each, and a browser check of the four pages
