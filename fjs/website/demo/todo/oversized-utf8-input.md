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

The limit applies to the bytes that are hashed. For SHA-1, SHA-2 and HMAC
those are the field's own bytes. PoW hashes its input with the decimal nonce
appended, so with the default nonce `42` its Input field fails past 131,070
bytes.

One byte past the limit, the runtime's `fail` replaces the whole demo with
`demo failed: assertion failed`. The input fields go with it, so the reader
cannot shorten the text and has to reload. Checked in headless Chromium at
`33888c887` (the VDF demo branch, which carries `main` at `4d037cd2c`): every
field above works when the hashed bytes are exactly at the limit and fails one
byte over.

That is a crash where [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
asks for a refusal.

### Proposal

Use `tryUtf8` and refuse oversized input in the view, in the shape the
[README's Refusals](../README.md#refusals) section describes. The bits demo
(`../bits/module.f.mjs`) and the VDF demo (`fjs/crypto/vdf/demo.f.mjs`)
already refuse this input, each in its own words; the wording is the
implementer's choice. An example:

```text
Input too long: more than 131072 UTF-8 bytes.
```

**`digestOf` in [`../hash/module.f.mjs`](../hash/module.f.mjs) returns
`string | null`**, `null` when the text is too long, the same convention as
`tryUtf8`. (`digestOf` in `fjs/git/oid` is an unrelated byte-level helper and
does not change.) `hashOutput` renders the refusal on `null`, and the `digest`
the SHA-1 and SHA-2 demos re-export takes the same type. That covers SHA-1 and
SHA-2 at once; HMAC and PoW each need their own call sites changed.

**PoW hashes in `update` too, not only in the view.** The `auto-run` and
`auto-next` branches call `tried`, which hashes the input with the nonce
appended, so a view-only refusal still crashes on Auto-run. A search can also
cross the limit midway: an input that, with nonce `99` appended, is exactly at
the limit hashes, and the step to `100` adds a byte. `tried` must not throw; an oversized input
plus nonce stops the search and shows the refusal.

Each demo's proof pins the refusal one byte past the limit, and for PoW the
limit counts the nonce.

### Tasks

- [ ] `digestOf` returns `string | null`; `hashOutput` and the SHA demos'
      `digest` follow
- [ ] HMAC: refuse an oversized key or message
- [ ] PoW: refuse an oversized input with its nonce appended, in the view and
      in `tried`, so Auto-run and a search crossing the limit stop instead of
      throwing
- [ ] proofs for each, PoW's covering an Auto-run click on oversized input and
      a nonce gaining a digit at the limit; a browser check of the four pages
