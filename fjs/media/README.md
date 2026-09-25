# Media formats

`fjs/media/` holds content formats — the modules that read and write content
whose identity is a media type — and the detector that recognizes them.
[`module.f.mjs`](./module.f.mjs) is the dialect-aware detection entry point
layered over the byte-signature detector in [`type/`](./type/README.md).

## Membership

A module goes under `fjs/media/` **iff it implements content whose identity is
a media type — or a named dialect of one** (below). The bucket is not
FunctionalScript-only: formats from other vendors (`text/html`,
`application/json`, …) live here beside the `vnd.fjs.*` ones.

Stays out:

- `text/` — character-encoding infrastructure (`utf8`, `utf16`, `ascii`,
  `code_point`, `sgr`), imported across the whole tree; the layer *below*
  media formats, not an implementation of `text/plain`.
- `js/` — language tooling consumed by the compiler; a hand-written scanner,
  so it is a *consumer* of grammars and stays out of
  [`fjs/ebnf/`](../ebnf/README.md) too.
- `basen/` — `base64`, `cbase32`, `base128` are transfer encodings, not media
  types.

There is no `media/fjs/` entry: `fjs/module.f.mjs` is only the CLI
dispatcher, so a `media/fjs/` module appears only if a library-form
FunctionalScript format module comes to exist.

Rejected names for the bucket: `mime/` (reads as detection, not content, and
collided with the former detector module, now [`type/`](./type/README.md)),
`format/` and `lang/` (no crisp membership rule — `media` plus the vendor tree
gives one).

## Dialects

Unregistered FunctionalScript formats are named by short **dialect** names in
the RFC 6838 vendor-tree style (`vnd.fjs.*`). How a dialect maps to a wire
media type depends on what the format is a subset of:

- **JSON subsets** embed their dialect as a `dialect` key of the payload
  (`{"dialect":"vnd.fjs.revision",...}`; key position carries no meaning —
  detection validates the parsed JSON against the dialect's schema) and are
  served with the **derived** media type `application/{dialect}+json` —
  `vnd.fjs.revision` → `application/vnd.fjs.revision+json`. The RFC
  6839-registered `+json` suffix makes the derived type recognizable to
  existing systems (browsers classify any `*+json` as a JSON MIME type — JSON
  module imports accept it), and a system that does not know the dialect still
  has the correct generic fallback: `application/json`. The embedded-tag
  convention itself is described in
  [`revision/README.md`](./revision/README.md).
- **JavaScript subsets** get **no new media type at all** — there is no
  registered `+javascript` suffix, and JavaScript MIME types are a closed list
  (RFC 9239: `text/javascript` plus obsolete aliases) that nothing extends, so a
  vendor type would be opaque to every existing consumer. The media type stays
  plain `text/javascript` and the dialect is surfaced out of band (below).
  FunctionalScript is `vnd.fjs.fjs`; DataJS is
  `vnd.fjs.datajs+vnd.fjs.fjs`, as [the DataJS
  specification](../../spec/datajs/README.md) defines it. Both are served as
  `text/javascript`.

### Fall-back chains

A dialect name may be a **fall-back chain**: `+` separates dialects, most
specific first, each segment an RFC 6838 restricted-name (no `+` inside a
segment). A consumer scans the chain left to right and processes the content as
the **first segment it implements**, ignoring unknown segments — safe because
each dialect in the chain guarantees the content is also valid as everything to
its right, so skipping a more specific dialect loses only its extra semantics,
never correctness. If no segment is known, the wire media type is the final
fall-back after the chain: `vnd.fjs.datajs+vnd.fjs.fjs` is processed as
DataJS, else as FunctionalScript, else as plain `text/javascript`.

The convention mirrors how media-type suffixes read (`application/did+ld+json`:
most specific first) — and because the standards give meaning only to the
*final* suffix of a media type, a derived `application/{dialect}+json` stays a
conformant `*+json` type even when the dialect itself contains `+`: to existing
systems, everything before the final `+json` is an opaque subtype name.

The `fjs.fjs` doubling is accepted for consistency; if FunctionalScript one day
gets its own standard media type, a short form such as `text/fjs` can supersede
the dialect name.

An earlier design named the subset `fjs/djs` implemented `vnd.fjs.djs`, with
the chain `vnd.fjs.djs+vnd.fjs.fjs`. `fjs/djs` is gone — its format became
[`datajs/`](./datajs/README.md) and its front end [`fsc/`](../fsc/README.md) —
and whether `vnd.fjs.djs` still names anything is open:
[datajs-dialect-name](./todo/datajs-dialect-name.md).

### Surfacing a dialect

Dialect surfacing is transport-generic: whenever a server knows the dialect, it
can attach it to the response — an additional `dialect` field in MCP responses
(MCP allows extra fields), a `Dialect` header in HTTP responses. A
`Content-Type` parameter would not be conformant: media-type parameters must be
defined by the type's registration, and RFC 9239 defines only `charset` for
`text/javascript`. For JSON subsets the field is redundant with the derived
media type, but harmless — clients get one uniform lookup order: `dialect`
field or header, else the embedded `{"dialect":...}` tag, else the media type.
Several `fjs/media/` directories may therefore share one media type and differ
only by dialect.

## The cycle rule

Whatever a consumer must import to recognize a format — its schema, its
`dialect` constant — is a `fjs/media/` sibling, never something living inside
a store or an adapter. `fjs/mcp` registers the revision dialect with the
detector, and `fjs/cas/evo` writes revisions, so both import the format; a
revision format inside `fjs/cas` would make every consumer of the format — the
detection path included — depend on the store. The revision *format* (schema,
tag, encode/decode) therefore lives at [`revision/`](./revision/README.md), while
the store-touching evolution operations (head resolution, materialization) stay
under [`fjs/cas/evo`](../cas/evo/) and import it. [`lock/`](./lock/README.md)
sits beside `revision/` for the same reason and imports the lock-map schema
from it rather than restating it.

The detector in [`module.f.mjs`](./module.f.mjs) takes the dialect entries as
a parameter rather than importing them, so it knows no dialect of its own;
[detect-json](./type/todo/detect-json.md) is the direction in which the
byte-level detector dispatches over its siblings' declared formats instead of
hard-coding per-format branches.
