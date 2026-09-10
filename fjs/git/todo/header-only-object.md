## A commit or a tag with no empty line: headers to the end of the object

**Priority:** P4
**Status:** open

### Problem

The header block's grammar in [`fjs/git/header`](../header/module.f.mjs)
reads `headers`, one empty line, and the message to the end, so a commit
or a tag whose bytes end right after its last header's LF — no empty
line, no message — is refused by `tryRead` with `null`. Git accepts such
an object: `git hash-object -t commit` writes it and `git fsck` reports
nothing, since `fsck` reads the headers it needs and stops. None of
Git's own writers make one — `commit-tree` and `mktag` always write the
empty line — so one comes from a hand-made object or another tool, and
old history may hold some.

### Proposal

Read it, and write it back byte for byte, which is the part that needs a
decision: `Payload` has one `message`, and an empty message after an empty
line and no empty line at all are two objects with one value under that
type. Either the empty line becomes optional in the grammar and
`message` becomes `Nullable<Bytes>`, `null` for the object with no empty
line, which is a change to `Payload` every reader shares; or the reader
accepts the form and the writer normalises it, which breaks the
byte-for-byte promise the signature work relies on. The first is right
and the second is not; the first is a breaking change to `Payload` and
waits for a consumer that meets such an object.

### Tasks

- [ ] `payload` with the empty line and the message optional, LL(1) as
      the block is: after the headers comes LF or the end of input.
- [ ] `message: Nullable<Bytes>`, and the writer that puts back no empty
      line for `null`.
- [ ] A fixture made with `git hash-object`, read and written back.

### Related

- [`fjs/git/README.md`](../README.md) — the header block, and reading
  versus vouching.
