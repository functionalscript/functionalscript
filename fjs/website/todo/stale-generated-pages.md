## The generator never removes output it no longer writes

**Priority:** P3
**Status:** open

### Problem

The site is generated next to its source: a directory's `index.html` sits in
the directory it describes, which is what lets a page fetch any repository file
by its own path. The generator only ever writes. Nothing removes a page whose
directory is gone.

So a directory that is deleted or renamed leaves its `index.html` behind, and
because git will not remove a directory that still holds an ignored file, the
directory survives the branch switch too. The next build walks it, finds a
directory, and gives it a page — and its parent a link to that page. The page
is empty, because the only file in the directory is the one the generator
wrote.

This is a *working tree* condition, not a shipped one. Deploys and CI build
from a fresh checkout, so no stale page reaches the site. What it costs is an
hour of someone's time when a page they cannot explain turns out to be their
own last branch: it cost exactly that during
[#1939](https://github.com/functionalscript/functionalscript/pull/1939), where
two such directories put the page count in the description two above the truth
until a reviewer measured it from a clean tree.

### Proposal

Three answers, in increasing cost. None is obviously right, which is why this
is a question rather than a task list.

- **Write it down and stop.** One line where someone debugging this would look
  — the generator's module documentation — saying a page with nothing in it is
  probably a directory that no longer exists. Cheapest, and it does not
  pretend the build is reproducible when it is not.
- **Skip a directory holding nothing but generated output.** Cheap and wrong
  in one case: a directory whose real files were all deleted in the same
  commit is exactly the state this cannot distinguish from a directory that
  never had any.
- **Delete what the build no longer writes**, which is the only answer that
  actually converges. It needs the generator to know its whole output set, and
  a `rm` of anything under a walked directory matching that shape — a
  destructive step in a build that has none today, and one that a bug in the
  output set turns into deleting somebody's file.

The deciding question is whether a build should be responsible for its own
leftovers at all, given that the one authority on what is stale — git — is
already telling the developer, and `git clean -Xd` already answers it.

### Tasks

- [ ] Decide which of the three, or that the answer is the first one.
- [ ] Do that.

### Related

- [An `index.html` for every module directory](directory-index-pages.md) — the
  design that put pages next to source, and why.
- [Generate website](generate-website.md) — the umbrella list.
