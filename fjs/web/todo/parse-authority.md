## parse-authority. The authority grammar is split across two readers

**Priority:** P4
**Status:** open

### Problem

"How an HTTP authority reads" is implemented in two places in
`fjs/web/module.f.mjs`, each with its own half of the grammar and its own
full prose justification of the same RFC 9110 userinfo rule:

- `parseTarget` (`:186-197`) refuses userinfo, an empty host, and a
  leading `:` — but knows nothing of brackets, ports, or the trailing
  root dot.
- `isServedHost` (`:411-431`) re-tests userinfo, then delegates brackets
  / port suffix / lowercase / root dot to `hostName`/`isPortSuffix`
  (`:376-409`) — but knows nothing of the empty-host rule.

On the absolute-form path the two meet: `respond` passes
`target.authority` — a string `parseTarget` has already guaranteed
carries no `userInfoMark` — into `isServedHost`, whose first act is to
test for it again. One check is unreachable on that path while both must
be kept correct. And because neither function owns the whole grammar, a
`Host: [::1` (unclosed bracket) is judged by one set of rules while
`http://[::1/x` is judged by the other.

### Proposal

One `parseAuthority: (s: string) => Nullable<{ name: string, port:
Nullable<string> }>` owning the whole rule — reject userinfo, reject
empty, split an optional bracketed literal from an optional `:port`,
lowercase, drop the trailing root dot — consumed by both callers.
`parseTarget` keeps the raw authority slice for its return value but
validates through it; `isServedHost` becomes a `parseAuthority` call plus
the `servedHosts` lookup, dropping `hostName`, `isPortSuffix`, and its
own userinfo test. The two RFC comment blocks merge into one at the new
function.

This changes a family of observable answers on the absolute-form path,
and the whole family is declared here rather than left to the
implementation. Today `parseTarget` never reads inside the authority, and
`resolve` uses only the path, so every authority `hostName` would refuse
is accepted by `resolve` as long as it is non-empty and carries no
userinfo: `resolve('.')` answers `ok('./x')` for `http://[::1/x`
(unclosed bracket), `http://localhost:bad/x` (non-numeric port),
`http://localhost:65536/x` (port out of range — `isPort` at
`module.f.mjs:360-375` reads the digits as a number and bounds them),
`http://localhost:8080:999/x` (two ports), and `http://[::1]evil/x`
(bytes after a literal). `parseAuthority` carries the whole of the
existing `hostName`/`isPort`/`isPortSuffix` grammar, so under the merged
rule **each of those is a `400 malformed request URL`** — the same refusal
`http:///x` and `http://:80/x` already get — because an authority the
grammar cannot read is a target this server cannot vouch for, and `new
URL` refuses every one of them too. The port grammar is kept, not
dropped: `isServedHost` refuses after the change exactly what it refuses
today, so the `Host`-header side loosens nothing.

### Tasks

- [ ] Extract `parseAuthority`; re-express `parseTarget`'s checks and
      `isServedHost` through it.
- [ ] Pin the family in the proof: `resolve('.')` answers `400` for
      `http://[::1/x`, `http://localhost:bad/x`,
      `http://localhost:65536/x`, `http://localhost:8080:999/x`, and
      `http://[::1]evil/x` — each a declared change from today's
      `ok('./x')`, so the PR carries a `Changelog:` entry — and
      `isServedHost` still refuses the same five as `Host` values.
- [ ] `tsc`, `fjs test`.

### Related

- [resolve-parsed-target.md](./resolve-parsed-target.md) — moves toward
  `respond` handing a parsed target down; composes with this, since a
  parsed target would carry `parseAuthority`'s record.
