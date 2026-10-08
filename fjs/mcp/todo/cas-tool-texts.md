## cas-tool-texts. `casToolRegistry` repeats one sentence four times and one read twice

**Priority:** P5
**Status:** wip

### Problem

In [`fjs/mcp/cas`](../cas/module.f.mjs)'s `casToolRegistry`, the
sentence telling the client where a `cas` command must run — on the same
host, container and account as the server, over the same ssh — is
written out in the `cas_add` description, the `cas_add` error, the
`cas_get` description and the `cas_get` too-large error. A fix to its
wording is four edits, and the four already have room to drift.

Inside `cas_get`, the arm that reads a whole blob,
`resultStep(collectRead(c.read(key)), …)`, is written twice, and so is
the `no such hash` refusal. The two arms do not fail the same way, and
that is deliberate: when the blob vanishes between `detectStream` and
`collectRead`, the metadata-only arm falls back to the streaming
verdict it already has, while the `content: true` arm answers
`no such hash`.

### Proposal

A local `runWhereServerRuns(command)` text builder and a `noSuchHash`
refusal, and one read-whole-blob step the two arms share. The shared
step takes the caller's failure continuation as a parameter — the
metadata arm passes "answer the streaming verdict", the content arm
passes `noSuchHash` — so what is shared is the read, and each arm's
answer to a vanished blob stays its own and observable as it is today.

### Tasks

- [ ] The three locals, the read step taking its failure continuation;
      `casToolRegistry` through them; both vanished-blob answers pinned
      in the proof.
- [ ] `tsc`, `fjs test`.

### Related

- [66k-cas-cli-mcp-shared-core](../../cas/todo/66k-cas-cli-mcp-shared-core.md)
  — the larger sharing between the CAS CLI and this server, which the
  shared read step would land in.
