## `packed-refs` promises its lines are sorted, and the lookup here does not use it

**Priority:** P3
**Status:** open

### Problem

A `packed-refs` file begins with a trait line — `# pack-refs with: peeled
fully-peeled sorted` — and `sorted` promises the records are in lexical order of
ref name. Git uses it: its lookup bisects the file rather than scanning it.

[`refstore`](../module.f.mjs)'s `packedId` scans. That costs a pass over every
line per lookup, which the module's own note about 20,000-name files says is the
size to think about, and it makes one answer differ from Git's on a file whose
trait is a lie. Measured on Git 2.43.0, with the trait claimed and the records
out of order:

```
# pack-refs with: peeled fully-peeled sorted
<id> refs/heads/z
<id> refs/heads/a

$ git rev-parse --verify refs/heads/z     # fatal: Needed a single revision
$ git rev-parse --verify refs/heads/a     # the id
$ git show-ref --verify refs/heads/z      # not a valid ref
$ git show-ref                            # lists both
$ git for-each-ref                        # lists both
```

So Git's *lookup* misses `z` and Git's *iteration* sees it. `tryResolve` answers
`z`'s id, which agrees with iteration and not with the lookup.

This reader is not going to reproduce that difference by reading the file two
ways, and the reason is that Git's answer here is not a rule: which lines a
bisection of an unsorted file finds depends on its probe sequence, so two
implementations that both honour the trait can disagree about the same file.
What is worth having is the *other* half — the lookup that does not scan.

### Proposal

- [`fjs/git/ref`](../../ref/module.f.mjs)'s `tryPacked` answers the traits beside
  the records, rather than skipping the header comment. That is a change to what
  it returns, so it is a declared break in whichever pull request makes it.
- `packedId` bisects where `sorted` is claimed and scans where it is not, which
  is what Git does and what the trait is for. A name found by bisection is found
  in the logarithm of the file rather than a pass over it.
- The out-of-order case then answers as Git's lookup does, and it answers so
  because both are bisecting rather than because this module imitates a probe
  sequence. Where the two disagree, the file is one `git pack-refs` never wrote.
- What stays: `tryRoots` lists every line, as `show-ref` and `for-each-ref` do
  and as `gc` needs. A record the lookup cannot find is still a retention root,
  which is the half that must not be lost.

### Related

- [`fjs/git/ref`](../../ref/module.f.mjs) — the grammar, and the header comment
  the traits live in.
- [`fjs/git/refstore`](../module.f.mjs) — `packedId`, the scan this would
  replace, and `tryRoots`, the iteration that must keep seeing every line.
- [gitformat-packed-refs](https://git-scm.com/docs/gitformat-packed-refs) — the
  trait line and what `sorted` promises.
