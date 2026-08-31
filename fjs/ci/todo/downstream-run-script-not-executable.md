## downstream-run-script-not-executable. A project running `fjs ci` gets `run` scripts it cannot run

**Priority:** P4
**Status:** open

### Problem

`fjs ci` writes `nix/<job>/run` beside each generated flake, and the workflow it
generates invokes it directly:

```sh
./nix/run git --version
```

`writeUtf8File` reaches `fs.promises.writeFile`, which creates a new file as
`0o666 & ~umask` — `100644` on a normal machine. So the first step of every
generated Nix job fails with `Permission denied` in a tree where that script did
not already exist.

This repository never sees it, and that is the trap. `fs.writeFile` **preserves
the mode of a file that already exists**: it truncates rather than recreating.
Every `nix/*/run` here is committed `100755`, recovered once by hand with
`git update-index --chmod=+x`, and stays executable through every regeneration.
Our CI is green on a property of our tree rather than on anything the generator
does.

A project adopting these flakes has no such tree. In one with no `nix/`
directory yet, *every* script is new at once, so it is not one job that fails
but all of them — and the fix is a command that only this repository's history
teaches. The drift check does not help either, there or here:
`git add -A && git diff --cached --exit-code` compares a tree the file is new
in, so there is no recorded mode to differ from.

Reported on [#1795](https://github.com/functionalscript/functionalscript/pull/1795).

### Why it is filed rather than fixed

The generated CI here runs, and no downstream project consumes these flakes
today — `fjs ci` is run by this repository, and the first generated flake landed
days ago. So the cost of the bug is currently zero and the cost of the fix is a
new operation in the effects layer, its virtual implementation, and the proofs
for both. Filed at the priority that reflects that, not at the one the word
"`Permission denied`" suggests.

What would raise it: a project outside this repository generating these files,
or the flakes being offered as something to adopt rather than something we
happen to run.

### Proposal

Two ways out, and choosing is most of the work:

1. **Make the generator set the bit**, which needs the effects layer to be able
   to express a mode at all — that is
   [generated-run-script-mode](generated-run-script-mode.md), which owns the
   design question, the Windows answer, and the virtual filesystem work. This
   issue is then fixed by fixing that one, and closes with it.
2. **Stop requiring the bit**, by generating `sh ./nix/<job>/run …` instead of
   `./nix/<job>/run …`. No effects work at all, and it is portable in the one
   direction that matters, since the mode has no meaning on Windows anyway. The
   price is real: every generated step names an interpreter, the shebang the
   script already carries stops being load-bearing, and a developer copying a
   command out of the workflow copies the `sh` with it.

2 is the cheap fix for this issue alone; 1 is the one that leaves the generator
able to emit an executable file, which is a capability rather than a workaround.
Prefer 1 if that issue is being done anyway, and reach for 2 only if this starts
costing someone.

### Tasks

- [ ] Decide between the effect and `sh`
- [ ] Whichever: prove it against a tree where the script does **not** already
      exist, since that is the only case that is broken and the one this
      repository's own files hide
- [ ] Drop the `git update-index --chmod=+x` note from `writeJob`'s docstring
      and `nix/README.md` once it is untrue

### Related

- [generated-run-script-mode](generated-run-script-mode.md) — the missing
  effects-layer capability, and option 1 above; this issue is the consequence
  of that gap for someone who is not us
- [65Z-ci-nix](65z-ci-nix.md) — owns the generated directory, and requires the
  generator stay Windows-compatible
- [ci-generator-audience](ci-generator-audience.md) — the same distinction this
  turns on: what the generator promises a project that runs it, versus what
  happens to hold in our tree
