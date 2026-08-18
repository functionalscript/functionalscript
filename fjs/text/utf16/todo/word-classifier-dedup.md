## word-classifier-dedup. `utf16ByteToCodePointOp` repeats the word classifier

**Priority:** P4
**Status:** open

### Problem

`utf16ByteToCodePointOp` (`fjs/text/utf16/module.f.mjs:185-207`) classifies
the word twice — once for the fresh-state dispatch and once for error
recovery after an unpaired high surrogate:

```ts
// state === null (:193-195)
if (isBmpCodePoint(word)) { return [[word], null] }
if (isHighSurrogate(word)) { return [[], word] }
return [[word | errorMask], null]

// recovery after an unpaired high surrogate (:205-206)
if (isBmpCodePoint(word)) { return [[state | errorMask, word], null] }
return [[state | errorMask], word]
```

The recovery arm is meant to be the fresh dispatch with the flushed error
(`state | errorMask`) prepended. This is the duplication PR #1258 removed
from utf8's `utf8ByteToCodePointOp` with a `restart(prefix)` helper
(`fjs/text/utf8/module.f.mjs:76-80`); utf16 is the same shape with a
different classifier, left undone by that PR.

**The two arms are no longer literally parallel.** The fresh arm is a
three-way classifier; the recovery arm is two-way, because `isLowSurrogate`
was already ruled out above it, so its trailing `return` covers the
high-surrogate case that the fresh arm spells out explicitly. Any `restart`
extraction has to reconcile that: `restart([state | errorMask])(word)` would
route a high surrogate through the fresh arm's `isHighSurrogate` branch and
emit `[[state | errorMask], word]`, which is what the recovery arm already
returns — so the rewrite looks sound, but it is a behavioral claim to prove
with a differential, not a pure textual dedup. Verify before assuming.

### Proposal

Mirror the utf8 fix: a fresh dispatch written once, parameterized by the
emitted prefix, called as `restart([])(word)` from the `state === null` arm
and `restart([state | errorMask])(word)` from the recovery arm.

Since utf8 already has its own `restart` (`fjs/text/utf8/module.f.mjs:76-80`),
this creates the second real consumer of the *"prefix a flushed error onto a
fresh dispatch"* wrapper, which by the AGENTS.md DRY rule justifies hoisting
the generic part into the codecs' shared dependency,
`fjs/text/code_point/module.f.mjs` (next to `decoder`; utf8 imports from
utf16, so `code_point` is the only cycle-free shared home):

```ts
// fjs/text/code_point/module.f.mjs
export const restart =
    <Cp, S>(fresh: (u: number) => readonly [readonly Cp[], S | null]) =>
    (prefix: readonly Cp[]) =>
    (u: number): readonly [readonly Cp[], S | null] => {
        const [emit, s] = fresh(u)
        return [[...prefix, ...emit], s]
    }
```

Each codec then keeps only its classifier:

```ts
// utf16
const fresh = (word: number): readonly [readonly CodePoint[], number | null] =>
    isBmpCodePoint(word) ? [[word], null]
    : isHighSurrogate(word) ? [[], word]
    : [[word | errorMask], null]
const restartUtf16 = restart(fresh)
// fresh arm:     restartUtf16([])(word)
// recovery arm:  restartUtf16([state | errorMask])(word)
```

and utf8's local `restart` becomes `restart(fresh)` over its existing
`byte < contTag` / `isLeadByte` classifier. If the generic hoist proves
noisier than it is worth, the fallback is a utf16-local `restart` mirroring
utf8's — that alone removes the in-module duplication; the shared version is
preferred because both consumers exist today.

### Tasks

- [ ] Add the generic `restart` to `fjs/text/code_point/module.f.mjs` (with
      proof coverage) and rewrite utf8's local `restart` through it.
- [ ] utf16: extract `fresh`; rewrite both arms of `utf16ByteToCodePointOp`.
- [ ] `npx tsc`, `fjs t`; utf8/utf16/code_point proofs must pass unchanged
      (pure refactor — byte-identical behavior).

### Related

- CHANGELOG PR #1258 — the utf8 half (`leadMin`/`leadMax`/`isLeadByte` +
  local `restart`); this issue is its utf16 counterpart plus the
  two-consumer generalization.
- `fjs/text/code_point/module.f.mjs` — `decoder` (`:41`) and `eofFlush` (`:66`), the
  already-shared halves of the streaming skeleton. `eofFlush` is the precedent
  this issue follows: the companion end-of-input extraction, landed the same
  way (one factory beside `decoder`, both codecs' ops derived from it).
