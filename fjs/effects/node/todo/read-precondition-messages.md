## read-precondition-messages. Both runners spell the `readFile` and `readBytes` refusals, differently

**Priority:** P4
**Status:** open

### Problem

`fjs/effects/node/module.f.mjs` is where a refusal both runners raise is
written once: `notAFileCode`/`notAFileMessage`,
`inflateTrailingCode`/`inflateTrailingMessage`, `emptyHostMessage`,
`badPortMessage`. The `readFile` size limit and the `readBytes` argument
checks never got there. The host runner and the virtual one each write
them:

```js
// fjs/effects/node/module.mjs, the readFile handler
throw new Error(`File size ${fileStats.size} exceeds maximum allowed size of ${Number(maxFileSizeBytes)} bytes: '${path}'`)
// the readBytes handler
throw new Error(`Offset ${offset} is negative`)
throw new Error(`Chunk size ${size} exceeds maximum allowed size of ${maxFileSizeBytes} bytes`)
// fjs/effects/node/virtual/module.f.mjs, readFile
return fail(`File size exceeds maximum allowed size of ${maxLengthBytes} bytes: '${path}'`)
// readBytesOp
if (!Number.isInteger(offset)) { return fail(`Offset ${offset} is not an integer`) }
if (!Number.isInteger(size)) { return fail(`Chunk size ${size} is not an integer`) }
if (offset < 0) { return fail(`Offset ${offset} is negative`) }
if (size < 0) { return fail(`Chunk size ${size} is negative`) }
```

The copies disagree in what they say and in what they refuse. The virtual
`readFile` message drops the size the host one reports. Only the virtual
runner refuses a negative `size` or a non-integer offset; the host runner
hands those to `Buffer.alloc`, whose own error is what the caller then
sees. A program proven against the virtual runner meets a different
refusal on the host, which is what the virtual runner exists to prevent.

The checks are pure — an integer test and a bound — and sit in the impure
`.mjs`, where nothing proves them.

### Proposal

The pure module owns the rule and its words, in the shape its siblings
already have:

```ts
/** The reason `readBytes(offset, size)` is refused before any read, or `null`. */
export const readBytesRefusal: (offset: number, size: number) => Nullable<string>
/** `readFile`'s refusal of a file larger than the limit. */
export const fileTooLargeMessage: (path: string, size: bigint) => string
```

The host runner throws the answer; the virtual one wraps it with `fail`.
Both then refuse the same inputs with the same message, and the virtual
runner's proof covers the rule for both.

`module.mjs` also builds a coded error as `Object.assign(new Error(m),
{ code })` at four sites; a local `hostError(code, message)` in the same
file is the natural companion, since the shape is the host's, not the
pure module's.

### Tasks

- [ ] `readBytesRefusal` and `fileTooLargeMessage` in
      `fjs/effects/node/module.f.mjs`, with proofs.
- [ ] Both runners call them; the host runner refuses what the virtual
      one refuses.
- [ ] `tsc`, `fjs test`.

### Related

- [../../todo/refuse-combinator.md](../../todo/refuse-combinator.md) — the
  composition at a site; this issue is the message the site carries.
- [../../todo/node-module-layering.md](../../todo/node-module-layering.md)
  — moves `readBytes` between modules; the shared rule moves with it.
