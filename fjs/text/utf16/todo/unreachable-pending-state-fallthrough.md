## Unreachable fall-through in `utf16ByteToCodePointOp`

**Priority:** P4
**Status:** open

### Problem

The last line of `utf16ByteToCodePointOp` (`module.f.mjs:196`) cannot be
reached, and `npm run cov` reports it as the module's only uncovered line
(99.71% lines, 96.55% branches — every other line is covered):

```js
const utf16ByteToCodePointOp = (word, state) => {
    if (!u16(word)) { return [[0xffffffff], state] }        // :181-183
    if (state === null) { /* … */ }                          // :184-188
    if (isLowSurrogate(word)) { /* … */ }                    // :189-193
    if (isBmpCodePoint(word)) { /* … */ }                    // :194
    if (isHighSurrogate(word)) { /* … */ }                   // :195
    return [[state | errorMask, word | errorMask], null]     // :196 — unreachable
}
```

The guard at `:181` restricts `word` to `0x0000`–`0xFFFF`, and within that
range the four predicates partition the space exhaustively:
`isBmpCodePoint` is *the BMP minus the surrogate block*, so a `word` that is
neither BMP, nor a high surrogate, nor a low surrogate does not exist. Both
surrogate halves are already handled above (`isLowSurrogate` at `:189`,
`isHighSurrogate` at `:195`).

AGENTS.md §3.2 says an unreachable line should be restructured away rather
than left uncovered: "If a line or branch genuinely cannot be reached,
restructure the code so it isn't there."

The `state === null` arm (`:184-188`) is *not* the same case — its final
`return [[word | errorMask], null]` handles an unpaired low surrogate and is
reachable. Only the pending-state arm has a dead tail.

### Proposal

Make the pending-state arm say what it means: with `state` non-null and the
low-surrogate case taken at `:189`, the remaining `word` is either a BMP code
point or a high surrogate, i.e. exactly the same classification the
`state === null` arm performs on a fresh word. Flush the pending state as one
error unit and re-dispatch the word through that fresh path:

```js
if (isBmpCodePoint(word)) { return [[state | errorMask, word], null] }
return [[state | errorMask], word]   // must be a high surrogate
```

That drops `:196` and the `isHighSurrogate` test with it. The
[word-classifier-dedup](./word-classifier-dedup.md) issue proposes extracting
exactly this "flush a prefix, then classify a fresh word" shape as a shared
`restart`/`fresh` helper (utf8 already has its local version). Fixing the
dead line and that extraction are the same edit to the same six lines, so do
them together — this issue exists to record *why* the line is dead and that
coverage depends on removing it, not to justify a separate PR.

Whatever the final shape, do not leave the fall-through in place with a
"can't happen" comment: an unreachable branch that the coverage tool counts
is what §3.2 forbids.

### Tasks

- [ ] Restructure the pending-state arm so no unreachable line remains
      (preferably as part of `word-classifier-dedup`).
- [ ] `npm run cov`: `fjs/text/utf16/module.f.mjs` reaches 100% lines and
      branches.
- [ ] `npx tsc`, `fjs test` — pure refactor, utf16 proofs unchanged.

### Related

- [word-classifier-dedup](./word-classifier-dedup.md) — the extraction this
  fix should ride along with; it rewrites the same lines.
- [decoder-oob-sentinel](./decoder-oob-sentinel.md) — the `:181` guard's
  magic `0xffffffff`; the same function, an independent defect.
- `fjs/text/code_point/module.f.mjs` — `isBmpCodePoint` / `isHighSurrogate` /
  `isLowSurrogate`, whose exhaustiveness over `0x0000`–`0xFFFF` is what makes
  the line dead.
