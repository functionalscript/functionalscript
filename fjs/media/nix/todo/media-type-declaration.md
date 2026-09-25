## media-type-declaration. `fjs/media/nix` and `fjs/media/rust` state no media type

**Priority:** P4
**Status:** open

### Problem

The membership rule in
[fjs/media/README.md](../../README.md#membership)
is "a module goes under `fjs/media/` iff it implements content whose identity
is a media type — or a named dialect of one". Every sibling makes that identity
findable:

| module | how its identity is stated |
|--------|----------------------------|
| `json` | named after a registered type; `application/json` needs no restating |
| `html` | named after a registered type; `text/html` needs no restating |
| `revision` | exports `mediaType` (`fjs/media/revision/module.f.mjs`), because its dialect is FS-specific |
| `type` | is the detector itself |
| `nix` | **nothing** |
| `rust` | **nothing** — its header calls it "the sibling of `fjs/media/nix`" |

`nix` and `rust` are the exceptions in both directions: each is named after a
format with *no* registered media type, so the name does not answer the
question the way `json` and `html` do, and neither declares a constant the way
`revision` does. A reader cannot determine what either module produces in
media-type terms from the module at all, and the bucket's own membership rule
is therefore unverifiable for the members that most need it stated.

### Proposal

Declare the conventional unregistered type in each module header —
`text/x-nix` in `fjs/media/nix/module.f.mjs`, and the same `x-` spelling for
Rust source in `fjs/media/rust/module.f.mjs`. That is the whole change: Nix
expressions and Rust literals *are* content, so the bucket is right and nothing
moves — only the declaration is missing.

If a detector ever dispatches over media types its siblings declare, export
the constant the way `fjs/media/revision` does (`export const mediaType`)
rather than leaving it in prose. Until then a header sentence is enough —
neither module has a parser, so there is nothing for a detector to dispatch to
yet, and an exported constant with no reader would be speculative API.

### Tasks

- [ ] State `text/x-nix` in the `fjs/media/nix/module.f.mjs` module header,
      and the Rust type in the `fjs/media/rust/module.f.mjs` one.
- [ ] Export each as `mediaType` **only** if a detector-side consumer exists by
      then; otherwise leave it as documentation.

### Related

- [fjs/media/README.md](../../README.md#membership)
  — the `fjs/media/` membership rule this applies.
- [serializer-validation-split](./serializer-validation-split.md) — a separate
  issue in the same module. This one was split out of it: that issue changes
  the serializer's return type and validation structure, and per
  [`AGENTS.md` §5](../../../../AGENTS.md#5-pull-requests-and-releases) a PR
  implements one improvement, so a media-type declaration does not belong in
  the same change. Neither blocks the other.
