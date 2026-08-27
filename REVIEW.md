# Addressing review comments

For the author of a pull request under review. Opening one is
[CONTRIBUTING.md](./CONTRIBUTING.md#opening-a-pull-request); the principles are
[DESIGN.md](./DESIGN.md).

**Merge the knowledge.** A small step merged with what was learned written down
beats two hundred iterations of a pull request that never lands. Most comments
are simply right — fix them. Push back on the rest, but never only in the
thread: a reason that lives there is gone the moment the pull request merges.

So the question about a comment is not "is this in scope" but **where does this
knowledge live once the pull request is merged?** In the diff, in the design
document, or in a `todo/` issue. "In the review thread" is the wrong answer.

| The comment | The answer |
| ----------- | ---------- |
| A design document is asked for implementation detail | The choice belongs to the implementer — write that into the document |
| An implementation is asked for another feature | Find or file a `todo/`, and reply with the link |
| One case is generalized into a rule | Answer with the case that breaks it, and record what the decision depends on |
| A defect is reported | Fix it, or defer it behind a `todo/` that names the input that breaks it |

A design settles *what* and *why*; data structures, helper splits, and internal
names are the implementer's. A reviewer calling a design **vague** claims the
opposite, and [DESIGN.md §3](./DESIGN.md#3-design-before-implementation) backs
them: a design that settles neither what nor why blocks implementation. The test
is whether two implementers working from it would produce the same observable
behavior and the same API — if they would, what is still open is theirs to
choose; if they would not, finish the design instead of pushing back.

A pull request implements one feature, so "while you're here" is a second one.
And a rule generalized from one real case fails on the case the reviewer did not
have in view: who runs this code, which inputs are real, and what the `todo/`
tree holds are things the author is looking at and the reviewer is not.

## Prototypes

When nobody yet knows whether a design works, prototype it — pushing back is not
refusing to look. Record what the prototype *uncovered*: the gray area, the
constraint that turned out to be real, the approach that could not be made to
work. Say it came from a prototype and does not bind the implementation. "We
tried X, and Y stops working" is worth more than a document specifying X.

## Deferring a defect

Even a crash may be deferred, and often should be: a pull request that grows a
fix for every defect a reviewer can name stops converging, and everything it
learned goes with it when it is abandoned.

How far depends on who runs the code and whether the input is real, never on
whether the crash is inside what the change claims to do. An internal script
that cannot read a file above 128 KB is a documented limit and a `todo/` — the
only people who can hand it a file are the people who maintain it, no such file
exists, and the day one does is the day the issue is picked up
([DESIGN.md §1](./DESIGN.md#1-simplicity-first)). A module in the published
package is the opposite: the input belongs to someone we have never met, so it
is fixed before it lands.

Never deferrable: a **regression**, and **silence**.

## Refusing loudly

An unsupported input is refused, never answered with a plausible wrong value —
**rejected** as a `try*` returning `Nullable<T>` where a caller may legitimately
supply it, **panicked** on where it violates a precondition
([DESIGN.md §10](./DESIGN.md#10-refuse-what-you-cannot-handle)). New code gets
that right before it lands. A defect found late may be staged behind an assert,
which stops the wrong answers today, as long as the `todo/` says the rejection
is what it still owes. Refuse fast, file, then fix.

## When it cannot land

If the honest answer is "nowhere, because this pull request is never going to
merge", change what the pull request is: drop the code and keep what it taught
— a rewritten `todo/`, a recorded failure, a note in the module's `README.md`.
Landing three paragraphs nobody has to rediscover beats closing after a hundred
comments with no diff.

The same holds for a design that does not survive implementation: rewrite the
`todo/`, never force the code through
([DESIGN.md §3](./DESIGN.md#3-design-before-implementation)).
