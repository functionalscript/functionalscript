## name-too-long-status. A path the file system cannot hold answers `500`

**Priority:** P4
**Status:** open

### Problem

`GET /<300 A's>` answers `500 io error: ENAMETOOLONG`. The request is
client-caused — no file system holds a 300-character component — so by this
module's own doctrine it belongs with the `400`/`404` answers rather than in the
channel reserved for the host failing at something it should have managed. The
same module already argues exactly this about `%00`: *"a NUL is a malformed URL,
not a host error"*.

Reported on
[#1693](https://github.com/functionalscript/functionalscript/pull/1693) and
pre-existing rather than a regression; no path leaks in the body, since a `500`
carries `errorSummary` and not the host's message.

Reachable in one more way than it looks: 5,000 percent escapes in a request line
decode to a 5,000-character component, so a target well within Node's 16 KB
limit already lands here.

### Proposal

Answer `404` — a name the file system cannot hold is a name that does not exist,
and whether it *could* have existed is not a distinction worth publishing.

The obstacle is proving it. The virtual file system has no name-length limit, so
the branch would be one nothing can reach, which the coverage gate rejects and
`fjs/AGENTS.md` §1.2 says to restructure away rather than leave uncovered. So the
fix is really two: give the virtual file system the limit a host has, and then
map the error. That is a change to the runner's contract — every operation on a
too-long name starts failing — and belongs in its own pull request.

### Tasks

- [ ] Give the virtual file system a name-length limit, reporting `ENAMETOOLONG`.
- [ ] Answer `404` for it in `fjs/web`, with the proof that limit makes possible.

### Related

- [`fjs/web`](../README.md) — the response table, where `500` currently covers it.
- `fjs/effects/node/virtual/module.f.mjs` — the file system that would grow the
  limit.
