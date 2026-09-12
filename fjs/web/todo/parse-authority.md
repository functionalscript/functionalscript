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

This changes one observable answer, and it is declared here rather than
left to the implementation. Today `resolve('.')('http://[::1/x')` is
`ok('./x')`: `parseTarget` accepts the unclosed bracket because it never
reads inside the authority, and `resolve` uses only the path. Under the
merged rule that input is a **`400 malformed request URL`**, the same
refusal `http:///x` and `http://:80/x` already get — an authority the
grammar cannot read is a target this server cannot vouch for, and `new
URL` refuses it too. `Host: [::1` was already refused by `isServedHost`;
after this both spellings are refused for the one reason.

### Tasks

- [ ] Extract `parseAuthority`; re-express `parseTarget`'s checks and
      `isServedHost` through it.
- [ ] Pin both bracket spellings in the proof: `Host: [::1` not served,
      `resolve('.')('http://[::1/x')` a `400` — a declared change from
      today's `ok('./x')`, so the PR carries a `Changelog:` entry.
- [ ] `tsc`, `fjs test`.

### Related

- [resolve-parsed-target.md](./resolve-parsed-target.md) — moves toward
  `respond` handing a parsed target down; composes with this, since a
  parsed target would carry `parseAuthority`'s record.
