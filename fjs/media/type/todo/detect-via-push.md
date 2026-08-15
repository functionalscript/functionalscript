## detect-via-push. `detect` re-drives the byte fold that `push` owns

**Priority:** P4
**Status:** open

### Problem

The module doc says both detectors read the signature table "through the same
eliminator (`magicStep`)" — true of the step, but the driving fold is written
twice:

```js
// fjs/media/type/module.f.mjs:120-128
export const detect = bytes => {
    let magic = magicInit
    for (const byte of iterable(u8List(msb)(bytes))) {
        magic = magicStep(magic, byte)
        if (magic.tag !== 'scan') { break }
    }
    return magicMime(magic)
}

// :198-210 — push: the same loop plus the utf8 factor, with isSettled as the break
```

`detect(bytes)` is equivalent to `magicMime(push(detectInit)(bytes).magic)`:
`push` breaks on `isSettled`, which returns `true` the moment the magic state
matches, and while the utf8 factor keeps running a settled magic state is a
fixed point of `magicStep` — the final `magic` is the same either way.

`detect` also has no production consumer: `fjs/mcp/cas` uses `detectStream`,
`fjs/media` uses `detectVec`; the only callers of `detect` are in
`fjs/media/type/proof.f.mjs`.

### Proposal

Make `detect` a projection of the state machine it fronts:

```js
/** @type {(bytes: Vec) => Nullable<string>} */
export const detect = bytes => magicMime(push(detectInit)(bytes).magic)
```

— or delete it and let the signature proofs assert on `detectVec`'s
`mime_type`. Verify the fixed-point claim about `magicStep` on settled states
in the proofs before relying on it (add a case if it isn't pinned yet).

### Tasks

- [ ] Rewrite `detect` over `push` (or remove it and repoint the proofs).
- [ ] `npx tsc`, `fjs t` — media/type proofs pass unchanged.

### Related

- `fjs/media/type/todo/detect-json.md` — extends what detection returns;
  fewer copies of the fold makes that change smaller.
