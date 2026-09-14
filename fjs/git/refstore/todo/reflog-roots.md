## A reflog entry keeps an object too, and `tryRoots` does not list it

**Priority:** P3
**Status:** open

### Problem

[`tryRoots`](../module.f.mjs) answers every ref a repository holds, and a ref is
a retention root. It is not the *only* kind: `logs/refs/**` and `logs/HEAD`
record where a ref has pointed, and Git keeps an object a reflog entry names
until that entry expires.

Measured on Git 2.43.0, in a repository of two commits:

```
$ git reset --hard HEAD~1        # the second commit is now only in the reflog
$ git rev-list --all | grep $LOST     # nothing: no ref names it
$ git gc --prune=now
$ git cat-file -t $LOST
commit                                # kept

$ git reflog expire --expire=now --expire-unreachable=now --all
$ git gc --prune=now
$ git cat-file -t $LOST
fatal: git cat-file: could not get object info
```

So the entry is a root with a clock on it: `gc.reflogExpire` defaults to 90 days
and `gc.reflogExpireUnreachable` to 30, and until then the object is recoverable
and Git will not drop it. `git fsck` reads the reflog the same way, which is
what `--no-reflogs` turns off.

The consequence for this module is a claim rather than an answer. Every entry
`tryRoots` gives is a real ref with a real id, so nothing it says is wrong; what
was wrong is that its doc called the list "the retention roots", which a caller
could read as *everything the repository is keeping* and prune by. The doc now
says refs, says what else keeps an object, and says not to prune by it. This
issue is the missing half.

An earlier revision of [ref-writing.md](../../todo/ref-writing.md) had it
backwards — "the reflog is not retention", reasoning from expiry to irrelevance.
Expiry is why a reflog root is *temporary*, not why it is absent, and the
measurement above is the case that breaks that reasoning.

### Proposal

- Read a reflog file: `logs/HEAD` and `logs/refs/**`, one entry per line,
  `<old> SP <new> SP <ident> TAB <message> LF`, where the message is optional
  and the ident is the same grammar
  [`fjs/git/ident`](../../ident/module.f.mjs) already reads. A grammar over the
  byte alphabet like the other ref files, in `fjs/git/ref` beside them, since
  nothing about it needs a filesystem.
- Answer the ids it holds from this module. Both the `old` and the `new` id of
  every entry are roots — an `old` is what `reset --hard` left behind and the
  reason the measurement above keeps anything — and the zero id that begins a
  reflog is no root at all.
- Keep it a separate function rather than folding it into `tryRoots`. A caller
  that wants to know what is *currently* reachable by name and a caller that
  wants to know what is *safe to delete* are asking different questions, and the
  second needs the expiry clock the first has no business reading. `tryRoots`
  answering both would mean answering a question about time from files that do
  not carry one — an entry's timestamp is in the ident, but whether it has
  expired depends on `gc.reflogExpire`, on `gc.reflogExpireUnreachable`, and on
  whether the id is reachable otherwise.
- What refuses: a reflog file that is there and is no reflog is a refusal the
  way a loose ref that is no ref already is. A missing one is an answer — a
  repository with `core.logAllRefUpdates` off keeps none.

### The bound this is under

A reflog root is retention and nothing else, exactly as a ref is:
[git-name-resolution](../../../../todo/git-name-resolution.md) gives Git's
namespace no DISOT meaning, and a reflog's *message* — `commit:`, `reset:`,
`checkout:` — is a record of what a person's tool did, not evidence about an
entity. Reading one to decide what DISOT means would be worse than reading a ref
name for it.

### Related

- [`fjs/git/refstore`](../module.f.mjs) — `tryRoots`, and the claim this
  narrows.
- [`fjs/git/todo/ref-writing.md`](../../todo/ref-writing.md) — the writing half,
  which appends to a reflog, and where the wrong reading of expiry came from.
- [`fjs/git/ident`](../../ident/module.f.mjs) — the `who` and `when` of an
  entry, already read for a commit and a tag.
