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
chain.

**Propagation is the default; `unwrap` is the rare exception.** Earlier drafts tried to
list which consumers were "bounded enough" to `unwrap`; review repeatedly found a real
caller proving each one wasn't (`writeUtf8File`/`writeResponse` → arbitrary content,
`asn.1` → caller payloads, `uint8array.listToVec` → HTTP request bodies). So invert the
rule:

> Every function whose output `Vec` length is **data-derived** — it builds from a list,
> string, or structure whose size comes from runtime input — returns `Nullable<Vec>` and
> threads the `null` to *its* caller. The over-cap signal only stops being `Nullable` in
> two places: (a) at an **I/O / protocol boundary**, where it is turned into a typed
> error (MCP `isError`, `IoResult` `error`, HTTP 413); or (b) at an **`unwrap`**, allowed
> *only* when the output length is **fixed by the algorithm** (independent of input size)
> or the input is a **source literal**.

This way a newly-discovered unbounded caller needs no plan change — it is already
`Nullable` and the type-checker forces its own caller to handle the `null`.

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

#### 3. The dividing line: two-vector *algebra primitives* stay total; *builders* propagate

Only the bottom-layer **algebra primitives** that combine *already-built* vectors stay
total — `concat`, `push`, `xor`, `repeat` — each returning `Vec` with a documented
`len ≤ maxLength` **precondition**, because their output length is a trivial function of
their already-known operands (`len(a)+len(b)`, `len+1`) that the immediate caller can
check *before* calling (the existing `collectRead` pattern: guard
`bitVecLength(acc) + bitVecLength(v) > maxLength` before `msb.concat`). The bounded core
of step 1 already enforces the cap for the *list* builders, so these primitives don't
re-check; making them partial would thread `null` through every bit-vector expression
and defeat the simplicity goal.

**Everything that builds a vector from a collection, string, or structure — not just two
known operands — is a *builder* and returns `Nullable<Vec>`.** That includes the
`fs/asn.1` encoders (`encode` / `encodeRaw` / `encodeSequence` / `encodeSet` /
`encodeObjectIdentifier` / `lenEncode` / `parsedTagEncode`): they wrap *caller-supplied*
payloads (an `OCTET STRING` or `SEQUENCE` can be near `maxLength`), and they're built on
the now-`Nullable` `listToVec`, so they **propagate** the `null` through the recursive
`encode` (threading it with the `fs/types/nullable` helpers) rather than `unwrap`-ing it.
The boundary that finally consumes asn.1's `Nullable` is wherever asn.1 output is written
or returned. (`encodeBoolean` / `encodeInteger` / `encodeOctetString` stay total — they
produce a `Vec` of trivially-known size from a scalar, like the algebra primitives.)

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

#### 5. `unwrap` — the rare exception (algorithm-fixed size or source literal)

Add a generic helper to `fs/types/nullable/module.f.ts`:

```ts
export const unwrap = <T>(value: Nullable<T>): T => {
    if (value === null) { throw 'unexpected null' }
    return value
}
```

`unwrap` (not a bare `!`, which only silences the type-checker) is allowed at a call
site **only** when the output length cannot depend on input size — so the `null` branch
is provably dead — and a violation should therefore fail loudly at its source. Two
admissible cases:

- **Algorithm-fixed size.** `fs/crypto/sign` `concat` joins a *fixed* number of
  *fixed-size* curve scalars / octet strings (≤ a few hundred bytes, set by the curve,
  never by user data); `fs/sul/id`'s id hash is a fixed 40-byte structure. These
  `unwrap(listToVec(...))` and keep their total `Vec` signatures.
- **Source literal.** `fs/sul/id`'s IV seed is `utf8` of a 32-char string literal in the
  source; test fixtures (`proof.f.ts`) are known-small literals. `unwrap` / `!` there.

Anything whose size is **data-derived** — even if "usually small" — does **not** qualify
and must propagate instead (step 6). When unsure, propagate: the type-checker then forces
the next caller to decide, which is exactly the safety we want. (`fs/sul/level/literal`'s
`listToVec(m(decode(literal)))` is only `unwrap`-able if a SUL literal token is bounded
*by construction*; if not, propagate it like any other builder.)

#### 6. Propagate `Nullable` through every data-dependent consumer; resolve it at the boundary

Each consumer below builds from data-derived input, so it returns `Nullable<Vec>` (or
threads a `null` it received). The signal is resolved into a typed error only at the
outermost I/O / protocol boundary:

- **`fs/types/uint8array` `toVec` and `listToVec`** → `Nullable<Vec>` (drop the current
  `throw`; the `null` *is* the over-cap signal). The Node HTTP `createServer` runner
  (`fs/effects/node/module.ts`, `body: listToVec(reqBody)`) collects an arbitrary-size
  request body, so on `null` it returns an error response (e.g. HTTP 413) instead of
  letting a throw escape the handler.
- **`fs/asn.1` encoders** → `Nullable<Vec>`, propagated through the recursive `encode`
  (step 3). Resolved wherever the DER bytes are written/returned.
- **`fs/effects/node` `writeUtf8File(path, content)`** → has an error channel
  (`Effect<WriteFile, IoResult<void>>`): on `utf8(content) === null` return an
  `IoResult` `error` instead of silently writing empty bytes.
- **`fs/effects/node` `writeString` (backs `log` / `error`) and `fs/mcp/stdio`
  `writeResponse`** — channel-less (`Effect<…, void>`) and inherently unbounded. The
  `write` / `writeFile` primitives take a single `Vec`, so today *any* > 128 KiB console
  line or MCP response is already unencodable; `Nullable` `utf8` only surfaces that. The
  real fix is a write primitive that accepts a **chunked byte stream** (size-independent,
  mirroring the streaming `cas_get` *metadata* path). Until that lands, see `cas_get`
  below; a first cut may scope the streaming-`write` refactor as a follow-up.
- **`fs/cas/mcp` `cas_get` `content: true`** — its guard rejects blobs whose *raw* length
  exceeds `maxLengthBytes`, but the **serialized response** (base64 ≈ 4/3× plus the JSON
  envelope) can still exceed `maxLength` and be unwritable even for a `maxLengthBytes`
  blob. Bound the *response* it emits (or stream it), so the transport is never handed
  more than one `Vec`. This is the concrete bug review flagged.
- **`fs/html` `htmlUtf8` and `fs/text/sgr` `csiWrite`** → `Nullable<Vec>` / handle `null`;
  they take arbitrary content.

The plan must **not** `unwrap` any of these; the over-cap `null` ends as a typed error
(`isError`, `IoResult` error, HTTP 413) or is avoided by streaming.

#### 7. `cas_add` never unwraps

The whole point: `cas_add` is the one place that **must not** assume the size is
bounded. On `null` from `utf8` / `decode` it returns a generic *content decoding error*
`isError` result. No branching on the cause is needed — the `cas_add` / `cas_get` tool
descriptions already document the 128 KiB inline limit and point oversized content at
`type: 'url'`, so a single static message restates that (the content could not be
decoded — it may be malformed or above the 128 KiB inline limit; use `type: 'url'` for
large content). Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

### Why propagate, and why `unwrap` (not `!`) at the exceptions

`null` is the codebase's documented absence convention (`fs/types/nullable/module.f.ts`,
with `map` / `match` / `toOption` / `fromUndefined`), and `base64.decode` already returns
`Nullable<Vec>`; staying on `null` avoids mixing `null` and `undefined`. Propagating it by
default — rather than swallowing it at each "looks bounded" site — is what preserves the
todo's goal: a detectable over-cap signal everywhere it can arise, resolved to a typed
error at the boundary. It also makes the design **review-stable**: a newly-found unbounded
caller is already `Nullable`, so the type-checker forces it to be handled instead of
silently crashing.

At the two admissible exceptions, `unwrap` beats a bare `!`: `!` only silences the
type-checker, so at runtime a (supposedly impossible) `null` survives and surfaces as an
obscure error far from its cause; `unwrap` turns "this is provably within the cap" into a
checked assertion that throws *at the call site*, while keeping the public type a plain
`Vec`.

### Tasks

- [ ] `fs/types/bit_vec/module.f.ts`: make `unpackListToVec` return `Nullable<Unpacked>`
      (running-length guard, single bounded core); make `BitOrder.listToVec` and
      `u8ListToVec` return `Nullable<Vec>`; leave the **algebra primitives**
      `concat` / `push` / `xor` / `repeat` total with a documented `len ≤ maxLength`
      precondition.
- [ ] `fs/types/nullable/module.f.ts`: add `unwrap<T>(value: Nullable<T>): T` (throws on
      `null`).
- [ ] `fs/base64/module.f.ts` `decode`: return `null` (not throw) for over-`maxLength`
      input; build only the trimmed `targetLen` bits so a `maxLengthBytes` blob does not
      overflow; **keep the RFC 4648 §3.5 padding-bit-zero check** (still reject
      non-canonical `AB==` / `AAB=`, all-`number` mask `=== 0`); signature stays
      `Nullable<Vec>`.
- [ ] `fs/text/module.f.ts` `utf8`: return `Nullable<Vec>` (`null` only when the encoded
      length would exceed `maxLength`).
- [ ] **Propagate `Nullable<Vec>`** (default) through the data-dependent builders/consumers,
      threading `null` to their callers:
      - `fs/asn.1` encoders (`encode` / `encodeRaw` / `encodeSequence` / `encodeSet` /
        `encodeObjectIdentifier` / `lenEncode` / `parsedTagEncode`) — propagate through
        the recursive `encode`; scalar encoders (`encodeBoolean` / `encodeInteger` /
        `encodeOctetString`) stay total.
      - `fs/types/uint8array` `toVec` and `listToVec` — drop the `throw`, return
        `Nullable<Vec>`.
      - `fs/sul/level/literal` `listToVec(...)` unless a SUL literal token is bounded by
        construction (then `unwrap`).
- [ ] **`unwrap` only at the algorithm-fixed / literal sites:** `fs/crypto/sign` `concat`
      (fixed curve components); `fs/sul/id` id hash (fixed 40 bytes) and IV-seed literal;
      `proof.f.ts` fixtures. (`fs/base_n` `stringToVec` already propagates `Nullable`.)
- [ ] Resolve the propagated `null` into a typed error at each boundary:
      - `fs/effects/node` `writeUtf8File` → `IoResult` `error`.
      - Node HTTP `createServer` runner (`fs/effects/node/module.ts`,
        `body: listToVec(reqBody)`) → error response (e.g. HTTP 413) on a `null` body.
      - `fs/effects/node` `writeString` / `fs/mcp/stdio` `writeResponse` / `fs/html`
        `htmlUtf8` / `fs/text/sgr` `csiWrite` → handle `null`; the durable fix is a
        chunked-stream `write` primitive (may be a follow-up).
      - `fs/cas/mcp` `cas_get` `content: true` → bound the *serialized response* (base64 +
        JSON envelope can exceed `maxLength` even for a `maxLengthBytes` blob) so the
        transport never gets an over-`maxLength` line.
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
