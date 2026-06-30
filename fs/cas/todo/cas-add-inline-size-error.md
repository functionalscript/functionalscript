## cas-add-inline-size-error. Reject oversized `cas_add` inline content gracefully

**Priority:** P3
**Status:** open
**Blocked by:** —

### Problem

The 128 KiB (`maxLength`) cap on `cas_add` inline content is **intentional and
desirable**, not an accident to be lifted. It applies only to *inlined* MCP content
(`type: 'text'` / `type: 'base64'`); `cas_add({ type: 'url', … })` and reading via the
`cas_get` `url` field already handle content of any size. We keep the inline cap on
purpose:

- **Uniform behaviour across JS engines.** A single `Vec` is a `bigint`. Every JS
  engine caps `bigint` size, but the cap differs: `bun` (WebKit/JSC) has the *smallest*
  limit and throws first, while `node`/`deno` (V8) allow much larger `bigint`s and so
  do *not* throw at 128 KiB (see the `maxLength` notes in
  `fs/types/bigint/module.f.ts`). So today the effective inline limit is
  engine-dependent. We want the *same* explicit 128 KiB limit and the *same* behaviour
  on every JS engine.
- **LLM token economy.** 128 KiB is a sensible ceiling that stops an LLM from burning
  tokens transferring large files inline; large blobs belong on the `url` path.
- **Library guidance.** We deliberately discourage large bit vectors. Big data should
  be partitioned and streamed, not loaded into memory as one piece.

The defect is only that the cap is **not enforced as a clean error**. The conversion
that builds the `Vec` runs *before* the `cas_add` handler can react:

- `type: 'text'` → `utf8(content)` (`fs/text/module.f.ts`)
- `type: 'base64'` → `decode(content)` (`fs/base64/module.f.ts`)

Each builds an over-`maxLength` `Vec`, so a size guard placed in the handler *after*
the conversion is too late: on `bun` the conversion has already thrown (crash), and on
`node`/`deno` it silently produces an over-`maxLength` blob that gets stored and then
cannot be read back inline via `cas_get` `content: true`. The MCP tool descriptions for
`cas_add` and `cas_get` already document the 128 KiB inline limit and steer callers to
`type: 'url'`; this issue is about making the runtime match that contract identically on
every engine.

### Proposal

The single hard requirement: **the conversion must not throw on `bun`** — an unhandled
throw inside the MCP server crashes the process. So the over-`maxLength` case becomes a
`null` (`Nullable<Vec>`) that is *detected and propagated*, never a thrown `bigint`.

This builds on the current fast many-into-one concatenation
(`fs/types/bit_vec/module.f.ts`, the O(n log n) binary-counter `unpackListToVec` from
[#1192](https://github.com/functionalscript/functionalscript/pull/1192)). Put the cap
check in **exactly one place** — `unpackListToVec` — and let `null` flow up the build
chain. Convert `null` back to a plain `Vec` only where the caller can *prove* the result
is within the cap, via an explicit `unwrap`/`assert` helper rather than a bare `!`.

#### 1. One bounded core: `unpackListToVec` returns `Nullable<Unpacked>`

`unpackListToVec` tracks the running total length and returns `null` *before*
combining an element that would push the result past `maxLength`, so no intermediate
`bigint` is ever built over the ceiling. The added cost on the happy path is one
`bigint` add + compare per element — negligible against the O(n log n) shifting, and a
free safety net for the total combinators below.

```ts
const unpackListToVec = (unpackConcat: BitOrder['unpackConcat']) =>
    (list: List<Unpacked>): Nullable<Unpacked> => {
        let result: readonly Unpacked[] = []
        let total = 0n
        for (const e of iterable(list)) {
            total += e.length
            if (total > maxLength) { return null }   // bail before building past the cap
            // …existing binary-counter carry loop, unchanged…
        }
        return result.reduce((p, c) => unpackConcat(c)(p), unpackEmpty)
    }
```

(No separate `unpackListToVecChecked` / `carryInsert` / `drain` split — a single bounded
core is the source of truth.)

#### 2. Propagate `Nullable` through everything built on the list builder

The two public faces of `unpackListToVec` become `Nullable`, and so does the boundary
string codec built on `listToVec`:

- `BitOrder.listToVec`: `(list: List<Vec>) => Nullable<Vec>` — `pack`-wraps the core's
  result, propagating `null`.
- `u8ListToVec`: `(list: List<number>) => Nullable<Vec>`.
- `fs/base_n` `stringToVec`: already `Nullable<Vec>` (returns `null` at the first
  out-of-alphabet char) — now its `null` also covers over-`maxLength` length.
- `fs/text` `utf8`: `Nullable<Vec>` (`null` only when the encoded length exceeds
  `maxLength`; every string is otherwise valid to UTF-8-encode).
- `fs/base64` `decode`: **keeps** its `Nullable<Vec>` signature; returns `null` for
  over-`maxLength` input (see step 4).

#### 3. Pure combinators (and the structured encoders built on them) stay total

`concat`, `push`, `xor`, `repeat` keep returning `Vec` with a documented
`len ≤ maxLength` **precondition**, because their output length is a trivial function
the caller already knows (`len(a)+len(b)`, `len+1`) and can check cheaply *before*
calling — exactly the existing pattern in `cas`'s `collectRead`, which guards
`bitVecLength(acc) + bitVecLength(v) > maxLength` before `msb.concat`. Making every
combinator partial would thread null checks through all bit-vector algebra and defeat
the simplicity goal.

**`fs/asn.1` belongs in this category, not in the "statically bounded" list.** Its
encoders (`encodeRaw` / `encode` / `encodeSequence` / `encodeSet` /
`encodeObjectIdentifier`) wrap *caller-supplied* payloads — an `OCTET STRING` or a
`SEQUENCE` can be near `maxLength` — so they are **not** fixed-size. But like the
combinators they are built on, their output length is a known function of their inputs
(`tag + length-prefix + Σ payload`), so they keep the same documented `len ≤ maxLength`
precondition and `unwrap` the now-`Nullable` `listToVec` to assert it. A precondition
violation throws (engine-independently) exactly as a too-long `concat` would — that is
the intended contract for the total layer, and it is **not reachable from `cas_add`**,
whose payloads route through the `Nullable` boundary in steps 2/6/7. Document the
precondition on the public asn.1 encoders. (If a future caller must encode genuinely
unbounded `OCTET STRING` payloads, the encoders should become `Nullable<Vec>` and
propagate — a separate change, called out so it is a conscious decision rather than a
silent `unwrap`.)

#### 4. `fs/base64` `decode` builds only the trimmed length

`decode` derives the decoded length up front and rejects `> maxLength` as `null`
*before building anything*. It then builds only `targetLen` bits: decode every 6-bit
chunk except the trailing one with `stringToVec`, then append just the data bits of the
last char. A `maxLengthBytes` blob's full `body.length * 6` is `targetLen + removeBits`
(a couple bits over the cap because of base64's octet padding), so splitting off the
last char keeps the largest intermediate vector at exactly `targetLen` bits and avoids
overflow.

**Preserve the RFC 4648 §3.5 padding-bit check.** The current decoder rejects
non-canonical inputs (`AB==`, `AAB=`, …) by verifying the discarded low `removeBits` of
the last char are zero (the existing `padVec` check, covered by `fs/base64/proof.f.ts`).
Splitting off the last char does **not** remove that obligation: before appending its
top `6 - removeBits` data bits, check the discarded low bits are zero and return `null`
otherwise — so the size fix does not loosen canonical-form validation. **Keep the mask
in a single numeric domain.** `lastIndex` (from `alphabet.indexOf`) and
`removeBits` (`= padChars * 2`, so `0 | 2 | 4`) are both `number`, so the check stays in
`number`: `(lastIndex & ((1 << removeBits) - 1)) === 0`. (Do **not** write `=== 0n`: a
`number & number` is a `number`, so comparing it to a `bigint` is always false and would
wrongly reject valid padded input; conversely `1 << removeBits` with a `bigint`
`removeBits` would throw. Pick one domain — `number` here, since the values are tiny.)

#### 5. `unwrap` for callers that are provably within the cap

Add a generic helper to `fs/types/nullable/module.f.ts`:

```ts
export const unwrap = <T>(value: Nullable<T>): T => {
    if (value === null) { throw 'unexpected null' }
    return value
}
```

Use `unwrap` (not a bare `!`) **only** at call sites whose input is *statically*
bounded, so a violated invariant fails loudly **at its source** instead of letting
`null` flow into a confusing downstream crash. These call sites keep their existing
total signatures:

- `fs/crypto/sign` `concat` (`(...x) => unwrap(listToVec(x))` — fixed-size curve
  scalars / hashes);
- `fs/sul/id` IV seed (`utf8` of a fixed 32-byte literal) and `fs/sul/id` /
  `fs/sul/level/literal` `listToVec(...)` over fixed-size ids / hashes;
- `fs/types/uint8array` `toVec` — it already **enforces its own explicit precondition**
  (`if (input.length > maxLengthBytes) throw …`) *before* building, so the `unwrap` after
  that guard cannot fire; this is the "document/enforce a real maximum" pattern, not a
  blanket unwrap of unchecked input.

(`fs/asn.1` is deliberately **not** here — its payloads are caller-supplied, so it is a
precondition-bearing combinator, handled in step 3 above. `fs/types/uint8array`
`listToVec` is **not** here either — its Node HTTP-runner caller feeds it arbitrary
request bodies, so it is an unbounded consumer; see step 6.)

Test files (`proof.f.ts`) follow the same rule — `unwrap` / `!` on known-small fixtures.

#### 6. Consumers whose input is NOT statically bounded — handle `null`, do not `unwrap`

Some `utf8` consumers serialize **arbitrary-size** content, so `unwrap` there would just
move the crash, not fix it (raised in review: a `cas_get` `content: true` response for a
`maxLengthBytes` *text* blob is already 131072 bytes **plus** the JSON/base64 envelope,
so the serialized response line exceeds `maxLength` even though the blob itself is at the
cap). These must convert `null` into a real error or be made size-independent:

- **`fs/effects/node` `writeUtf8File(path, content)`** — has an error channel
  (`Effect<WriteFile, IoResult<void>>`): on `utf8(content) === null` return an
  `IoResult` `error` instead of writing, so an over-cap write fails loudly rather than
  silently truncating to empty bytes.
- **`fs/effects/node` `writeString` (backs `log` / `error`) and `fs/mcp/stdio`
  `writeResponse`** — channel-less (`Effect<…, void>`) and inherently unbounded. The
  `write` / `writeFile` primitives take a single `Vec`, so today *any* > 128 KiB
  console line or MCP response is already unencodable; making `utf8` `Nullable` only
  surfaces that. The correct fix is to make the write primitive accept a **chunked byte
  stream** (size-independent, mirroring the streaming `cas_get` *metadata* path), so
  encoding is no longer capped by one `Vec`. Until that lands, the immediately
  actionable guard is in `cas_get`:
- **`fs/cas/mcp` `cas_get` `content: true`** — its current guard rejects blobs whose
  *raw* length exceeds `maxLengthBytes`, but the **serialized response** (base64 ≈ 4/3×
  plus the JSON envelope) can still exceed `maxLength` and become unwritable. Tighten the
  guard to bound the *response* it is about to emit (or stream it), so the transport is
  never handed more than one `Vec`. This is the concrete bug the review flagged.
- **`fs/html` `htmlUtf8` and `fs/text/sgr` `csiWrite`** — also take arbitrary content;
  propagate `Nullable` (or document the cap) rather than `unwrap`, per the same rule.
- **`fs/types/uint8array` `listToVec` and its Node HTTP-runner caller** — the impure
  `createServer` runner (`fs/effects/node/module.ts`, `body: listToVec(reqBody)`)
  collects an **arbitrary-size request body** and feeds it to `listToVec`. So
  `listToVec` must propagate `Nullable<Vec>` rather than throw, and the runner must map a
  `null` body (request > 128 KiB) to an error response (e.g. HTTP 413) instead of letting
  the throw escape the request handler. (`toVec` stays total — it has its own explicit
  size guard, step 5.)

The first cut may scope the streaming-`write` refactor as a follow-up, but the plan must
**not** `unwrap` these paths; at minimum `writeUtf8File` returns an error, `cas_get`
`content: true` bounds its response, and the HTTP runner rejects over-cap request bodies.

#### 7. `cas_add` never unwraps

The whole point: `cas_add` is the one place that **must not** assume the size is
bounded. On `null` from `utf8` / `decode` it returns a generic *content decoding error*
`isError` result. No branching on the cause is needed — the `cas_add` / `cas_get` tool
descriptions already document the 128 KiB inline limit and point oversized content at
`type: 'url'`, so a single static message restates that (the content could not be
decoded — it may be malformed or above the 128 KiB inline limit; use `type: 'url'` for
large content). Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

### Why `unwrap` and not `!`

`null` is the codebase's documented absence convention (`fs/types/nullable/module.f.ts`,
with `map` / `match` / `toOption` / `fromUndefined`), and `base64.decode` already returns
`Nullable<Vec>`; staying on `null` avoids mixing `null` and `undefined`. A bare `!` only
silences the type-checker — at runtime the `null` survives and surfaces as an obscure
error far from its cause. `unwrap` makes "I am sure this is within the cap" an explicit,
checked assertion that throws at the call site, while keeping the function's public type
a plain `Vec`. Propagating `Nullable` (rather than swallowing it) is what preserves the
todo's actual goal: a detectable over-cap signal everywhere it can arise, collapsed back
to total only where correctness guarantees it.

### Tasks

- [ ] `fs/types/bit_vec/module.f.ts`: make `unpackListToVec` return `Nullable<Unpacked>`
      (running-length guard, single bounded core); make `BitOrder.listToVec` and
      `u8ListToVec` return `Nullable<Vec>`; leave `concat` / `push` / `xor` / `repeat`
      total with a documented `len ≤ maxLength` precondition.
- [ ] `fs/types/nullable/module.f.ts`: add `unwrap<T>(value: Nullable<T>): T` (throws on
      `null`).
- [ ] `fs/base64/module.f.ts` `decode`: return `null` (not throw) for over-`maxLength`
      input; build only the trimmed `targetLen` bits so a `maxLengthBytes` blob does not
      overflow; **keep the RFC 4648 §3.5 padding-bit-zero check** (still reject
      non-canonical `AB==` / `AAB=`); signature stays `Nullable<Vec>`.
- [ ] `fs/text/module.f.ts` `utf8`: return `Nullable<Vec>` (`null` only when the encoded
      length would exceed `maxLength`).
- [ ] `unwrap` at the *statically bounded* `listToVec` / `u8ListToVec` / `utf8`
      consumers only: `fs/crypto/sign`, `fs/sul/id`, `fs/sul/level/literal`, and
      `fs/types/uint8array` `toVec` (which keeps its own explicit `> maxLengthBytes`
      throw before the `unwrap`). (`fs/base_n` `stringToVec` already propagates
      `Nullable`.)
- [ ] `fs/asn.1`: keep the encoders total but document their `len ≤ maxLength`
      precondition (output = `tag + length + Σ payload`); `unwrap` the `Nullable`
      `listToVec` to assert it. Caller-supplied payloads make these *precondition*
      sites, not fixed-size ones; revisit (make `Nullable`) only if asn.1 must encode
      unbounded `OCTET STRING` payloads.
- [ ] Handle `null` (do **not** `unwrap`) at the unbounded consumers:
      `fs/effects/node` `writeUtf8File` → return an `IoResult` `error`; `writeString` /
      `fs/mcp/stdio` `writeResponse` / `fs/html` `htmlUtf8` / `fs/text/sgr` → propagate or
      document, pending a size-independent (chunked-stream) `write` primitive.
- [ ] `fs/types/uint8array` `listToVec` → `Nullable<Vec>`; the Node HTTP `createServer`
      runner (`fs/effects/node/module.ts`, `body: listToVec(reqBody)`) maps a `null` body
      (request > 128 KiB) to an error response (e.g. HTTP 413) instead of throwing out of
      the request handler.
- [ ] `fs/cas/mcp` `cas_get` `content: true`: bound the *serialized response* it emits
      (base64 + JSON envelope can exceed `maxLength` even for a `maxLengthBytes` blob),
      so the transport is never handed an unencodable, over-`maxLength` line.
- [ ] `cas_add` handler (`fs/cas/mcp/module.f.ts`): treat `null` from `utf8` / `decode`
      as a generic content decoding error `isError` (static message that also points at
      `type: 'url'` for large content).
- [ ] Proof tests: `fs/cas/mcp/proof.f.ts` — inline `text` and `base64` at exactly
      `maxLengthBytes` (stored) and one byte over (clean `isError` on every engine — not
      a thrown crash, not a silently-stored over-`maxLength` blob). Add a
      `base64OfA(n)` helper that spells out base64 of `n` ASCII `'a'` bytes for any `n`
      (handles all three `n % 3` residues), so the boundary sample never drives the
      encoder past `maxLength`. `fs/types/bit_vec/proof.f.ts` — `u8ListToVec` at and one
      past `maxLengthBytes`.
- [ ] Confirm the documented inline limit in `fs/cas/mcp/README.md` and the `cas_add`
      tool description match the implemented behaviour.

### Related

- `fs/cas/mcp/module.f.ts` — `cas_add` handler and the `cas_get` `content: true`
  oversized-blob guard it should mirror.
- `fs/types/bit_vec/module.f.ts` — fast `unpackListToVec` / `listToVec` (the bounded
  core lives here).
- `fs/types/bigint/module.f.ts` — `maxLength` notes on `bun` throwing near the ceiling.
- `fs/cas/mcp/README.md` — documents the 128 KiB inline limit and the `type: 'url'`
  alternative.
