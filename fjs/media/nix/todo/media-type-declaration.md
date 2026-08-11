## media-type-declaration. `fjs/media/nix` states no media type

**Priority:** P4
**Status:** open

### Problem

The membership rule agreed in
[group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
is "a module goes under `fjs/media/` iff it implements content whose identity
is a media type — or a named dialect of one". Every sibling makes that identity
findable:

| module | how its identity is stated |
|--------|----------------------------|
| `json` | named after a registered type; `application/json` needs no restating |
| `html` | named after a registered type; `text/html` needs no restating |
| `revision` | exports `mediaType` (`fjs/media/revision/module.f.ts:34`), because its dialect is FS-specific |
| `type` | is the detector itself |
| `nix` | **nothing** |

`nix` is the exception in both directions: it is named after a format with *no*
registered media type, so the name does not answer the question the way `json`
and `html` do, and it declares no constant the way `revision` does. A reader
cannot determine what the module produces in media-type terms from the module
at all, and the bucket's own membership rule is therefore unverifiable for the
one member that most needs it stated.

### Proposal

Declare the conventional unregistered type `text/x-nix` in
`fjs/media/nix/module.f.mjs`'s module header. That is the whole change: Nix
expressions *are* content, so the bucket is right and nothing moves — only the
declaration is missing.

If the detector direction in [detect-json](../../type/todo/detect-json.md)
later lands a sibling-declared `{ mime, … }` record for the detector to
dispatch over, export the constant the way `fjs/media/revision` does
(`export const mediaType`) rather than leaving it in prose. Until then a header
sentence is enough — `fjs/media/nix` has no parser, so there is nothing for a
detector to dispatch to yet, and an exported constant with no reader would be
speculative API.

### Tasks

- [ ] State `text/x-nix` in the `fjs/media/nix/module.f.mjs` module header.
- [ ] Export it as `mediaType` **only** if a detector-side consumer exists by
      then; otherwise leave it as documentation.

### Related

- [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
  — the `fjs/media/` membership rule this applies.
- [detect-json](../../type/todo/detect-json.md) — the direction in which
  siblings declare `{ mime, parse, serialize }` for the detector; it decides
  whether this becomes an export.
- [serializer-validation-split](./serializer-validation-split.md) — a separate
  issue in the same module. This one was split out of it: that issue changes
  the serializer's return type and validation structure, and per `AGENTS.md`
  §8.1 a PR implements one improvement, so a media-type declaration does not
  belong in the same change. Neither blocks the other.
