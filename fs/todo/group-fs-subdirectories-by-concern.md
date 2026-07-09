## Group `fs/` subdirectories by concern

**Priority:** P4
**Status:** open

`fs/` has 28 top-level directories mixing foundational data structures (`types`), byte/character encoders (`base64`, `base128`, `cbase32`), language tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`), crypto, storage (`cas`, `sul`), and project infrastructure (`ci`, `dev`, `website`). Regroup incrementally — not a big-bang reorg, since every cross-module import is a relative `.f.ts` path.

### 1. `fs/basen/` — group base-N encoders

Move `base64`, `base128`, `cbase32` under `fs/basen/`. They are sibling alphabet-parameterised encoders sharing a codec factory.

### 2. `fs/common/` — common algorithms

Create `fs/common/` for cross-cutting reusable algorithms, starting by moving `monoid` (currently `fs/types/monoid`) there. Admit only genuinely cross-cutting *algorithms* — not data structures or type-level utilities.

### 3. Promote `fjs` bin to `fs/` root

`fs/fjs/module.f.ts` is the top-level CLI dispatcher — nothing imports it as a library. Move `fs/fjs/{module.ts, module.f.ts, proof.f.ts, README.md}` to `fs/`. Update `package.json` (`bin.fjs`, scripts) and `deno.json` (`fjs` task). Fix relative imports (drop one `../`).

### Later candidates

- Tooling bucket for `bnf`, `fsc`, and possibly `js` (grammar/compiler tooling;
  the content-facing formats go to `fs/media/`, see below).
- Storage bucket for `cas` + `sul`; testing bucket for `asserts` + `emergent_testing`.

### 4. `fs/media/` — content formats and media-type detection

The agreed design for the format bucket. First wave — only these three:

```
fs/media/
    html/       text/html (moved from fs/html)
    json/       application/json (moved from fs/json)
    revision/   dialect vnd.fjs.revision, served as
                application/vnd.fjs.revision+json (format only, new code —
                see fs/cas/todo/revision-content-format.md)
```

Later candidates for the same bucket, deliberately deferred to keep each PR
small:

- `media/type/` — media-type detection (today's `fs/mime`), renamed;
- `media/djs/` — mimeType `text/javascript`, dialect `vnd.fjs.djs+vnd.fjs.fjs`.

**Membership rule:** a module goes under `fs/media/` iff it implements content
whose identity is a media type — or a named **dialect** of one (see below).
Unregistered FS formats are named by short **dialect** names in the RFC 6838
vendor-tree style (`vnd.fjs.*`); how a dialect maps to a wire media type
depends on what the format is a subset of:

- JSON subsets embed their dialect as the first key of the payload
  (`{"dialect":"vnd.fjs.revision",...}`) and are served with the **derived**
  media type `application/{dialect}+json` — e.g. `vnd.fjs.revision` →
  `application/vnd.fjs.revision+json`. The RFC 6839-registered `+json`
  suffix makes the derived type recognizable to existing systems (browsers
  classify any `*+json` as a JSON MIME type — e.g. JSON module imports
  accept it), and any system that does not know the dialect still has the
  correct generic fallback: `application/json`.
- JavaScript subsets get **no new media type at all** — there is no
  registered `+javascript` suffix, and JavaScript MIME types are a closed
  list (RFC 9239: `text/javascript` plus obsolete aliases) that nothing
  extends, so a vendor type would be opaque to every existing consumer. The
  mimeType stays plain `text/javascript` and the dialect is surfaced out of
  band (e.g. an additional `dialect` field in MCP responses — MCP allows
  extra fields). So FJS is dialect `vnd.fjs.fjs` and DJS is dialect
  `vnd.fjs.djs+vnd.fjs.fjs` (a fall-back chain, see below), both served as
  `text/javascript`.

A dialect name may be a **fall-back chain**: `+` separates dialects, most
specific first, each segment an RFC 6838 restricted-name (no `+` inside a
segment). A consumer scans the chain left to right and processes the content
as the **first segment it implements**, ignoring unknown segments — safe
because each dialect in the chain guarantees the content is also valid as
everything to its right, so skipping a more specific dialect loses only its
extra semantics, never correctness. If no segment is known, the wire media
type is the final fall-back after the chain. DJS is a subset of FJS, so its
dialect is `vnd.fjs.djs+vnd.fjs.fjs`: process as DJS, else as FJS, else as
plain `text/javascript`. The convention mirrors how MIME suffixes read
(`application/did+ld+json`: most specific first) — and because the standards
give meaning only to the *final* suffix of a media type, a derived
`application/{dialect}+json` stays a conformant `*+json` type even when the
dialect itself contains `+`: to existing systems, everything before the
final `+json` is an opaque subtype name.

Dialect surfacing is transport-generic: whenever a server knows the dialect,
it can attach it to the response — an additional `dialect` field in MCP
responses (MCP allows extra fields), a `Dialect` header in HTTP responses (a
Content-Type parameter would not be conformant: media-type parameters must
be defined by the type's registration, and RFC 9239 defines only `charset`
for `text/javascript`). For JSON subsets the field is redundant with the
derived mimeType, but harmless — clients get one uniform lookup order:
`dialect` field/header, else the embedded `{"dialect":...}` tag, else
mimeType. Multiple `fs/media/` directories may therefore share one mimeType
and differ only by dialect. The `fjs.fjs` doubling is accepted for consistency; if
FunctionalScript one day gets its own standard MIME type, a short form such
as `text/fjs` can supersede the dialect name. The bucket is not FS-only: any
media type qualifies, so formats from other vendors (`text/html`,
`application/json`, …) live here alongside the `vnd.fjs.*` ones. Note there
is no `media/fjs/` entry:
today's `fs/fjs` is only the CLI dispatcher, which item 3 above promotes to
`fs/` root, leaving nothing to move — a `media/fjs/` module appears only
if a library-form FJS format module comes to exist.

**`media/type/`** is the current `fs/mime` detector, renamed: detection is
about media *types*; the sibling directories are the media themselves. This
placement enables the declarative step (see
[fs/mime detect-json](../mime/todo/detect-json.md)): the detector can dispatch
over its siblings' declared `{ mime, parse, serialize }` instead of hardcoding
per-format branches.

**Cycle rule** (the reason `revision` is in the list): whatever the detector
must import to recognize a format — its schema, its `dialect` constant — must
be a `media/` sibling, never live inside a store or adapter. Concretely:
`fs/cas/mcp` depends on the detector, and detecting revision blobs requires the
revision schema, so a revision format inside `fs/cas` would create a
`cas` ↔ detector cycle. The revision *format* (schema, tag, encode/decode)
therefore lives at `fs/media/revision/`, while the store-touching evolution
operations (head resolution, materialization) stay under `fs/cas` and import
it — see [fs/cas revision-content-format](../cas/todo/revision-content-format.md).

**Stays out:**

- `text/` — character-encoding infrastructure (`utf8`, `utf16`, `ascii`,
  `code_point`, `sgr`) with ~39 importers across the tree; the layer *below*
  media formats, not an implementation of `text/plain`. Remains top-level.
- `js/` — `identifier` + `tokenizer` only, i.e. language tooling consumed by
  `djs`/`fsc`, closer in kind to `bnf`; decide with the tooling bucket, not here.
- `base64`/`base_n`/`cbase32`/`base128` — transfer encodings, not media types
  (they move under `fs/basen/`, item 1 above).

**Rejected names** for the bucket: `mime/` (collides with the existing detector
module and reads as detection, not content), `format/`/`lang/` (no crisp
membership rule — `media` + the vendor tree gives one).

**Migration:** incremental, one move per PR — directory paths are the public
API (no `exports` map), so every move is a breaking change. The first wave is
`json` and `html` (moves) plus `revision` (new code, no move); the
`fs/mime` → `media/type/` rename and `djs` follow later.

### Tasks

- [x] Create `fs/basen/` and move `base64`, `base128`, `cbase32` into it.
- [x] Create `fs/common/` and move `monoid` from `fs/types/` into it.
- [x] Promote the `fjs` bin to `fs/` root; update `package.json`/`deno.json` script paths and fix relative imports.
- [x] Move `fs/json/` → `fs/media/json/` (one PR; establishes the `fs/media/` bucket).
- [x] Move `fs/html/` → `fs/media/html/` (one PR).
- [ ] `fs/media/revision/` arrives as new code via [fs/cas revision-content-format](../cas/todo/revision-content-format.md) — no move needed.
- [ ] Later: rename `fs/mime/` → `fs/media/type/`.
- [ ] Later: move `fs/djs/` → `fs/media/djs/`.
- [x] Update all relative imports referencing the moved modules.
- [ ] Update `deno.json` `exports` map and run `npm run update` (no `exports` map exists in `deno.json` currently; nothing to update).
- [x] Verify `npx tsc` and `fjs t` pass.
