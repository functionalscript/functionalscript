## Group `fjs/` subdirectories by concern

**Priority:** P4
**Status:** open

`fjs/` has 28 top-level directories mixing foundational data structures (`types`), byte/character encoders (`base64`, `base128`, `cbase32`), language tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`), crypto, storage (`cas`, `sul`), and project infrastructure (`ci`, `dev`, `website`). Regroup incrementally — not a big-bang reorg, since every cross-module import is a relative `.f.mjs` path.

### 1. `fjs/basen/` — group base-N encoders

Move `base64`, `base128`, `cbase32` under `fjs/basen/`. They are sibling alphabet-parameterised encoders sharing a codec factory.

Done. The three codecs moved first, then the codec factory they share followed:
`fjs/base_n/` was a top-level directory whose name differed from `fjs/basen/` by
one underscore, and two directories one character apart — one holding the
factory, the other its consumers — was a live confusion hazard in imports and in
`grep`. The whole directory moved, not just the module: the factory is now
`fjs/basen/module.f.mjs`, the parent of the codecs that call it, and its proof is
`fjs/basen/proof.f.mjs` (it is the factory's only proof — it covers `normalize`,
invalid input, chunk boundaries and large inputs, so leaving it behind would have
silently dropped `baseN`'s coverage). The two open issues moved to
`fjs/basen/todo/` and `fjs/base_n/` is deleted.

### 2. `fjs/common/` — common algorithms

Create `fjs/common/` for cross-cutting reusable algorithms, starting by moving `monoid` (currently `fjs/types/monoid`) there. Admit only genuinely cross-cutting *algorithms* — not data structures or type-level utilities.

### 3. Promote `fjs` bin to `fjs/` root

`fjs/fjs/module.f.mjs` is the top-level CLI dispatcher — nothing imports it as a library. Move `fjs/fjs/{module.ts, module.f.mjs, proof.f.mjs, README.md}` to `fjs/`. Update `package.json` (`bin.fjs`, scripts) and `deno.json` (`fjs` task). Fix relative imports (drop one `../`).

### Later candidates

- No `fjs/grammar/` bucket. [ebnf-migration](./ebnf-migration.md) builds
  `fjs/ebnf/` beside `fjs/bnf/`, with the grammar machinery inside it, and
  retires `bnf/`; it also settles that `fsc` and `js` stay out as consumers
  (the content-facing formats go to `fjs/media/`, see below).
- Storage bucket for `cas` + `sul`; testing bucket for `asserts` + `emergent_testing`.

### 4. `fjs/media/` — content formats and media-type detection

The agreed design for the format bucket. First wave — only these three:

```
fjs/media/
    html/       text/html (moved from fjs/html)
    json/       application/json (moved from fjs/json)
    revision/   dialect vnd.fjs.revision, served as
                application/vnd.fjs.revision+json (format only, new code —
                landed; see fjs/media/revision/README.md)
```

A fourth followed by the same membership rule: `media/lock/` — dialect
`vnd.fjs.lock`, served as `application/vnd.fjs.lock+json`, a revision's `lock`
map stored on its own so several revisions can share one resolution. It sits
beside `revision/` for the same cycle reason (see below), and imports the map
schema from it rather than restating it.

Later candidates for the same bucket, deliberately deferred to keep each PR
small:

- `media/djs/` — mimeType `text/javascript`, dialect `vnd.fjs.djs+vnd.fjs.fjs`.

`media/type/` — media-type detection, renamed from `fjs/mime` — has landed; see below.

**Membership rule:** a module goes under `fjs/media/` iff it implements content
whose identity is a media type — or a named **dialect** of one (see below).
Unregistered FS formats are named by short **dialect** names in the RFC 6838
vendor-tree style (`vnd.fjs.*`); how a dialect maps to a wire media type
depends on what the format is a subset of:

- JSON subsets embed their dialect as a `dialect` key of the payload
  (`{"dialect":"vnd.fjs.revision",...}`; key position carries no meaning —
  detection validates the parsed JSON against the dialect's schema) and are
  served with the **derived**
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
mimeType. Multiple `fjs/media/` directories may therefore share one mimeType
and differ only by dialect. The `fjs.fjs` doubling is accepted for consistency; if
FunctionalScript one day gets its own standard MIME type, a short form such
as `text/fjs` can supersede the dialect name. The bucket is not FS-only: any
media type qualifies, so formats from other vendors (`text/html`,
`application/json`, …) live here alongside the `vnd.fjs.*` ones. Note there
is no `media/fjs/` entry:
today's `fjs/fjs` is only the CLI dispatcher, which item 3 above promotes to
`fjs/` root, leaving nothing to move — a `media/fjs/` module appears only
if a library-form FJS format module comes to exist.

**`media/type/`** is the former `fjs/mime` detector, renamed: detection is
about media *types*; the sibling directories are the media themselves. This
placement enables the declarative step (see
[fjs/media/type detect-json](../media/type/todo/detect-json.md)): the detector can dispatch
over its siblings' declared `{ mime, parse, serialize }` instead of hardcoding
per-format branches.

**Cycle rule** (the reason `revision` is in the list): whatever the detector
must import to recognize a format — its schema, its `dialect` constant — must
be a `media/` sibling, never live inside a store or adapter. Concretely:
`fjs/mcp` depends on the detector, and detecting revision blobs requires the
revision schema, so a revision format inside `fjs/cas` would create a
`cas` ↔ detector cycle. The revision *format* (schema, tag, encode/decode)
therefore lives at `fjs/media/revision/`, while the store-touching evolution
operations (head resolution, materialization) stay under `fjs/cas` and import
it — see [fjs/media/revision/README.md](../media/revision/README.md) and
[fjs/cas/evo](../cas/evo/).

**Stays out:**

- `text/` — character-encoding infrastructure (`utf8`, `utf16`, `ascii`,
  `code_point`, `sgr`) with ~39 importers across the tree; the layer *below*
  media formats, not an implementation of `text/plain`. Remains top-level.
- `js/` — `identifier` + `tokenizer` only, i.e. language tooling consumed by
  `djs`/`fsc`; a hand-written scanner, so it is a *consumer* of grammars and
  stays out of `fjs/ebnf/` too ([ebnf-migration](./ebnf-migration.md)).
- `base64`/`basen`/`cbase32`/`base128` — transfer encodings, not media types
  (they move under `fjs/basen/`, item 1 above).

**Rejected names** for the bucket: `mime/` (collides with the existing detector
module and reads as detection, not content), `format/`/`lang/` (no crisp
membership rule — `media` + the vendor tree gives one).

**Migration:** incremental, one move per PR — directory paths are the public
API (no `exports` map), so every move is a breaking change. The first wave is
`json` and `html` (moves) plus `revision` (new code, no move); the
`fjs/mime` → `media/type/` rename has since landed; `djs` follows later.

### Tasks

- [x] Create `fjs/basen/` and move `base64`, `base128`, `cbase32` into it.
- [x] Move the shared codec factory `fjs/base_n/module.f.ts` to `fjs/basen/module.f.mjs` **together with `fjs/base_n/proof.f.ts`** (→ `fjs/basen/proof.f.mjs`), move `fjs/base_n/todo/*` to `fjs/basen/todo/`, and delete `fjs/base_n/`.
- [x] Create `fjs/common/` and move `monoid` from `fjs/types/` into it.
- [x] Promote the `fjs` bin to `fjs/` root; update `package.json`/`deno.json` script paths and fix relative imports.
- [x] Move `fjs/json/` → `fjs/media/json/` (one PR; establishes the `fjs/media/` bucket).
- [x] Move `fjs/html/` → `fjs/media/html/` (one PR).
- [x] `fjs/media/revision/` arrived as new code (the `vnd.fjs.revision` format) — no move needed.
- [x] Rename `fjs/mime/` → `fjs/media/type/`.
- [x] Promote `types/rtti` to `fjs/rtti` — the same membership rule as item 2, applied
      to the largest thing in `types/`.
- [ ] Later: move `fjs/djs/` → `fjs/media/djs/`.
- [x] Update all relative imports referencing the moved modules.
- [ ] Update `deno.json` `exports` map and run `npm run lock-update` (no `exports` map exists in `deno.json` currently; nothing to update). **When a map is first introduced it must enumerate every `module.f.mjs` then present** — a partial map silently restricts a package that is unrestricted today. Modules proposed meanwhile are counting on this: `fjs/effects/{all,sandbox,console,test}` ([node-module-layering](../effects/todo/node-module-layering.md)) records that its registration lands here rather than in its own change. `fjs/media/json/grammar` was a second such dependent until [bnf-grammar-single-owner](../bnf/todo/bnf-grammar-single-owner.md) withdrew it: the canonical JSON grammar ships as a proof-covered example under `fjs/bnf/lib/json`, so there is no module at that path to register.
- [x] Verify `tsc` and `fjs t` pass.
