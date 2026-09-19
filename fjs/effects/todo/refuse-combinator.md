## refuse-combinator. `pureError(ioError({ code, message }))` is spelled at about twenty sites

**Priority:** P4
**Status:** open

### Problem

`fjs/effects` owns both halves of a refusal — `ioError` and `pureError` —
but not their composition, so every module that refuses with a code and a
message writes the object literal itself. `fjs/git/refstore` has about
eight such sites, `fjs/git/packstore` five, and `fjs/effects/node`,
`fjs/cas` and `fjs/protocol/mcp/stdio` the rest:

```js
// fjs/git/refstore/module.f.mjs, readAsRef
return pureError(ioError({ code: badNameCode, message: badNameMessage(item.path) }))
// fjs/git/refstore/module.f.mjs, statted
: pureError(ioError({ code: linkedDirCode, message: linkedDirMessage(item.path) })))
// fjs/git/packstore/module.f.mjs — three local wrappers for the same literal
const notAFile = path => pureError(ioError({ code: notAFileCode, message: notAFileMessage(path) }))
const refuse = what => pureError(ioError({ code: packFileCode, message: `${path} ${what}` }))
const entryRefusal = (path, at) => what => pureError(ioError({ code: packEntryCode, message: `${path}:${at} ${what}` }))
```

`packstore` has already invented the helper three times over; `refstore`
has not, and several of its refusals run to three lines.

### Proposal

One export beside `pureError`:

```ts
/** A refused effect: an `ioError` carrying `code` and `message`. */
export const refuse: (code: string, message: string) => Effect<never, never, IoChannel>
```

Every site becomes one line, `packstore`'s three wrappers become partial
applications of it, and `refstore`'s `xCode`/`xMessage` pairs can move
beside the site that uses them, so the module doc's table of which listing
refuses what is checkable against the code.

### Tasks

- [ ] `refuse` in `fjs/effects/module.f.mjs` with a proof.
- [ ] Rewrite the sites in `fjs/git/refstore`, `fjs/git/packstore`,
      `fjs/effects/node`, `fjs/cas`, `fjs/protocol/mcp/stdio`.
- [ ] `tsc`, `fjs test`.

### Related

- [map-step-combinator.md](./map-step-combinator.md) — the precedent:
  a derived combinator landed, then the call sites converted.
