## unlistable-directory. Tell a directory the shell cannot list from a file

**Priority:** P2
**Status:** open

### Problem

The host's `readdir` (`../module.mjs`) classifies each entry by whether
`os.file.listDir` lists it: a directory if it does, a file if it does not. The
shell has no `stat`, and `listDir`'s error names no reason, so a directory it
may not list — no read permission, an I/O error — is reported as a file.
Discovery then skips it as a file whose name matches nothing, and
`npm run sm t` passes without the proofs below it. Node's `readdir` reports
the same entry as a directory, and the walk fails listing it, so `fjs t` fails
loudly there. A pass that skipped proofs without saying so is silence
([AGENTS.md §5](../../../../AGENTS.md#5-pull-requests-and-releases)).

Raised in review of
[#2986](https://github.com/functionalscript/functionalscript/pull/2986#discussion_r4295621257).
CI's checkout is readable throughout, so it takes a local tree with a
directory its user cannot read.

`readWhole` and `writeBytes` refuse a directory through the same check. There
an unlistable directory falls through to `os.file.readFile`, which fails too —
a failure either way, with a less exact message.

### Proposal

**Ask `test` when `listDir` fails.** One `os.system` call per such entry — a
script answering its exit code, `if [ -d … ]; then exit 1; elif [ -f … ];
then exit 2; else exit 3; fi`, the path quoted as one shell word — classifies
it as Node's `Dirent` does: a directory, a regular file, or neither. An
unlistable directory is then a directory, and the walk fails listing it, as on
Node; a dangling symbolic link or a socket is neither, and is skipped unless
its name matches, as on Node.

- **Cost.** Measured on SpiderMonkey 140.14.0: 1.44 ms a call. Only entries
  `listDir` refuses need one — about 2,400 in this repository, the files — so
  about 3.5 seconds on a whole-tree `npm run sm t` of about 3¾ minutes.
- **Approval.** It is a third use of `os.system`, beside the `mkdir` and `rm`
  the owner approved for this host (AGENTS.md §6), and needs the same
  approval. It builds on the quoting and `os.system` that
  [#2991](https://github.com/functionalscript/functionalscript/pull/2991)
  adds.
- **Links.** `test -d` follows a symbolic link, where Node's `Dirent` reports
  a link as neither; the repository tracks no links, as the host already says
  of `listDir`.

**Rejected: refuse an entry that neither lists nor reads.** It needs no
subprocess, and reading every file is cheap — 2,440 files, 16.5 MB, about
30 ms. But Node reports a dangling symbolic link or an unreadable file as
neither and skips it unless its name matches, and Emacs keeps a dangling
`.#name` link beside every file it is editing, so `npm run sm t` would fail
while a buffer is modified.

**Rejected: read the error message.** `listDir` says the same for a file and
for an unlistable directory, and `readFile` tells them apart only in some
cases; matching the text would answer with confidence it has no basis for
(AGENTS.md §6).

### Tasks

- [ ] Classify an entry `listDir` refuses with one `os.system` call to
      `test`, and report a directory, a file, or neither from its exit code.
- [ ] Check in the shell, as a user without read permission: an unlistable
      directory fails the run, a dangling symbolic link is skipped, and a
      whole-tree `npm run sm t` stays within a few seconds of today's.
