## Directory, name and ancestor helpers are written outside `fjs/path`

**Priority:** P3
**Status:** open

### Problem

[`fjs/path`](../module.f.mjs) owns path manipulation: `concat`, `join`,
`under`, `relativize`, `isProperPrefix`. It has no function for the three
questions a file path is asked most often — its directory, its last name,
and the directories above it — so every module that asks writes an answer of
its own, over `lastIndexOf('/')` and `split('/')`:

- **The directory of a path**, three ways. `dirOf` in
  [`fjs/website`](../../website/module.f.mjs) slices at the last slash and
  answers `'.'` for a bare name. `outputDirectory` in
  [`fjs/compiler`](../../compiler/module.f.mjs) is `pathConcat(name)('..')`
  with the same `'.'` fallback. `parentOf` in
  [`fjs/git/refstore/write`](../../git/refstore/write/module.f.mjs) slices at
  the last slash with no fallback at all. The three disagree at the edges:
  for a rooted name such as `/x`, `dirOf` answers `''` where
  `outputDirectory` answers `/`.
- **The ancestors of a path**, twice. `ancestors` in `refstore/write`
  walks `split('/')` into every proper prefix; `ancestors` in
  [`fjs/website/page`](../../website/page/module.f.mjs) does the same walk
  and pairs each prefix with its name under a `'.'` root.
- **The name and its extension.** `extension` in
  [`fjs/media/type`](../../media/type/module.f.mjs) takes the text after
  the last slash and then after its last dot, with the rule that a leading
  dot is a name and not an extension — a basename and an extension rule,
  both written inline in a media-type table.
- **A second `resolve`.** `fjs/website`'s private `resolve` is
  `pathConcat(`${from}/..`)(specifier)`, which is
  [`fjs/path/import`](../import/module.f.mjs)'s exported `resolve` without
  the `decode` step. The website's import graph therefore resolves a
  specifier a browser would percent-decode or refuse differently from the
  compiler and the virtual host.

[DESIGN.md §4](../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns)
names this case outright: path manipulation belongs in `fjs/path`, even with
one consumer. Here there are several, and they have already drifted on what
the directory of `/x` is.

### Proposal

`fjs/path` exports the three questions, each with one answer for the edge
cases the copies now settle differently:

- `parent` (or `dirname`): the directory a path sits in, `'.'` for a bare
  name, the root for a name directly under it. `dirOf`, `outputDirectory`
  and `parentOf` become calls.
- `name` (or `basename`), and `extension` beside it or in `fjs/media/type`
  over `name` — the leading-dot rule stays wherever `extension` lives.
- `ancestors`: the proper prefixes of a path, shortest first. The website's
  `'.'` root label and name pairing stay with the page, as a map over the
  result.

`fjs/website`'s `resolve` goes; the page asks `fjs/path/import`'s.

### Tasks

- [ ] Decide the names and the edge rules, in `fjs/path`'s JSDoc, with the
      `/x` case stated.
- [ ] Implement with a proof at 100%, and move the five sites above onto
      the exports in the same PR.
- [ ] Replace `fjs/website`'s `resolve` with `fjs/path/import`'s and check
      the site's import graph is unchanged.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [import-root-split](./import-root-split.md) — the same module re-deriving
  a root rule `fjs/path` already owns; this issue is the directory, name and
  prefix rules.
- [compile-output-parent-segments](../../compiler/todo/compile-output-parent-segments.md)
  — `outputDirectory`'s `..` handling, which a shared `parent` must keep.
- [write-files](../../effects/node/todo/write-files.md) — the proposed
  `writeFiles` needs the parent of each output path; it should take it from
  here rather than write a fourth one.
