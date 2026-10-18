## unlistable-directory. Tell a directory the shell cannot list from a file

**Priority:** P2
**Status:** open

### Problem

The host's `readdir` (`../module.mjs`) classifies each entry by whether
`os.file.listDir` lists it: a directory if it does, a file if it does not. The
shell has no `stat`, and `listDir`'s error names no reason, so a directory it
may not list — no read permission, an I/O error — is reported as a file.
Discovery then skips it as a file whose name matches nothing, and `fjs t` on
SpiderMonkey passes without the proofs below it. Node's `readdir` reports
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

**A FIFO reads as a file too, and reading one can hang.** `listDir` refuses a
FIFO, so `readdir` reports it as a file, where Node's `Dirent` says it is
neither and discovery skips it. `npm run sm c` then hands a FIFO named
`*.f.js` to `readWhole`, as it does a FIFO named as the input. Measured on
SpiderMonkey 140.14.0: `os.file.readFile` blocks in its `open` while no process
has the FIFO open for writing, and once one does it fails with `can't seek
end of …`. So `npm run sm c <(…) out.js` is refused, and only a FIFO nothing
writes to hangs. Node's `readWhole` refuses both before opening, because
`stat` says neither is a regular file. Raised in review of
[#2990](https://github.com/functionalscript/functionalscript/pull/2990#discussion_r4297513555).
No FIFO is in the repository.

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
  about 3.5 seconds on a whole-tree SpiderMonkey run of about 3¾ minutes.
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
`.#name` link beside every file it is editing, so `fjs t` on SpiderMonkey would
fail while a buffer is modified.

**Rejected: read the error message.** `listDir` says the same for a file and
for an unlistable directory, and `readFile` tells them apart only in some
cases; matching the text would answer with confidence it has no basis for
(AGENTS.md §6).

### Tasks

- [ ] Classify an entry `listDir` refuses with one `os.system` call to
      `test`, and report a directory, a file, or neither from its exit code.
- [ ] Refuse in `readWhole`, and in `writeBytes` where the host has it, a path
      that `test -f` says is not a regular file, before `readFile` opens it,
      as Node's `stat` check does: a FIFO no process writes to then fails
      rather than hangs.
- [ ] Check in the shell, as a user without read permission: an unlistable
      directory fails the run, a dangling symbolic link is skipped, and a
      whole-tree SpiderMonkey run stays within a few seconds of today's.
