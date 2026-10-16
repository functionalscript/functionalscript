## mkdir. Make directories in the SpiderMonkey shell

**Priority:** P3
**Status:** open

### Problem

The SpiderMonkey shell has no way to make a directory: `os.file` lists a
directory, reads a file, and replaces a file whole, and nothing else. The host
(`../module.mjs`) answers `mkdir` only where Node's answer changes nothing — a
recursive `mkdir` of a directory that exists, which is how `writeFiles` makes
sure an output's directory is there — and refuses everything else. So
`npm run sm c in.f.js out/x.js` works when `out` exists and is refused when it
does not, where `npm start c` makes it.

### Proposal

Make the directory with the shell's subprocess call:
`` os.system(`mkdir -p ${quoted}`) ``. Measured on SpiderMonkey 140.14.0:

- `os.system` runs the command through the system shell and returns the raw
  wait status: `0` on success, `768` for an exit code of `3`. Success is `0`,
  and anything else is the failure, named with the path and the status.
- The path reaches a shell, so it is quoted: wrapped in single quotes, each `'`
  inside spelled `'\''`. `os.spawn` also takes one command string, so it does
  not avoid the quoting.
- A non-recursive `mkdir` is `mkdir` without `-p`, failing on a directory that
  exists as Node's does.

This calls an external tool from our code, which
[AGENTS.md §6](../../../../AGENTS.md#6-external-tools) holds to approval; the
owner chose this route when the existing-directory answer landed (#2990).

It is POSIX: `mkdir -p` is not a `cmd.exe` command. The shell itself runs on
Windows — Mozilla publishes `jsshell-win64.zip` beside the Linux and macOS
builds — but this host reads its paths as POSIX paths already, so a Windows
host is its own task, taken when someone needs one.

### The same gap for large outputs

`writeUtf8File` writes a text whose UTF-8 does not fit one `Vec` (128 KiB) in
chunks: `writeFile` for the first, `writeBytes` at the offset where the last
ended for each next, and `rm` of the partial file if one fails. The shell has
neither a positional write nor a delete, so the host answers both
`NotImplemented`. The first chunk is written by then, so such an output is left
truncated, though the command exits `1`. No authored module compiles to an
output that large today — the largest, `spec/datajs/vectors/accept/data.f.js`,
is 75 KB. The same subprocess route gives `rm` (`rm -f`), and `writeBytes` at
the end of a file — the only offset `writeChunks` uses — can read the file,
append, and replace it whole.

### Tasks

- [ ] `mkdir` through `os.system`, quoting the path and failing on a nonzero
      status.
- [ ] `rm`, and a `writeBytes` that appends, so a large output is written whole
      or not at all.
- [ ] Check in the shell: compiling into a directory that does not exist, and
      an output over 128 KiB.
