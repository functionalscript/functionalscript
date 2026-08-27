# Addressing review comments

This document is for the author of a pull request under review. It covers which
comments to fix, which to push back on, and what a push-back has to leave
behind. Opening the pull request in the first place is
[CONTRIBUTING.md](./CONTRIBUTING.md#opening-a-pull-request); the facts that
outrank everything here are [DESIGN.md](./DESIGN.md), and the summary an agent
reads first is [AGENTS.md §5](./AGENTS.md#5-pull-requests-and-releases).

One criterion decides all of it. Working on a pull request teaches you
something — about the design, about the runtime, about the shape the code wants
to take — and that knowledge is the part worth keeping. **Merge the
knowledge.** A small step merged with what was learned written down beats two
hundred iterations of a pull request that never lands: the merged step is a
result somebody can build on, and the abandoned pull request is nothing at all,
however much understanding went into it.

Most review comments are therefore simply right and simply fixed: the bug, the
simpler expression, the answer to the question. The rest ask the pull request
to grow rather than to improve, and an author may push back on those — but a
push-back is never a dismissal. Each one leaves something behind in the
repository, because a reason that lives only in a review thread is gone the
moment the pull request is merged.

## Contents

1. [A design document asked for implementation detail](#1-a-design-document-asked-for-implementation-detail)
2. [An implementation asked for another feature](#2-an-implementation-asked-for-another-feature)
3. [A reviewer turned one case into a universal rule](#3-a-reviewer-turned-one-case-into-a-universal-rule)
4. [Deferring a defect](#4-deferring-a-defect)
5. [Refusing loudly](#5-refusing-loudly)
6. [Where the knowledge lives](#6-where-the-knowledge-lives)
7. [When the design does not survive implementation](#7-when-the-design-does-not-survive-implementation)

---

## 1. A design document asked for implementation detail

A pull request whose diff is a `todo/` file — or a design section of a
`README.md` — settles *what* is being built and *why*, not *how*. The data
structures, the helper split, the order of the passes, and the names inside the
module belong to whoever implements it; pinning them in the design either
freezes a decision nobody yet has the information to make, or is quietly
ignored once the code exists. So when a reviewer asks the design to spell out
an implementation, say that the choice is left to the implementer — and **write
that answer into the design document**, not only into the review thread. The
next reader of the issue then finds the question already asked and already
answered instead of asking it again. If the answer turns out to constrain the
implementation after all — a bound the rest of the document depends on, an API
its other sections assume — then it was design and not detail: record the
constraint, and leave everything it does not decide open.

Pushing back is not refusing to look. When the reviewer's question is genuinely
open — nobody yet knows whether the shape works — **write a prototype**, and
put what it *uncovered* into the design document: the gray area it exposed, the
constraint that turned out to be real, the approach that could not be made to
work. Say in the document that it came from a prototype and does not bind the
implementation. The prototype's job is to find the unknowns, not to become the
code that ships, and it will usually be thrown away; a design recording "we
tried X, and Y stops working" is worth more than one that specifies X.

## 2. An implementation asked for another feature

A pull request implements one feature or improvement, with minimal code changes
([AGENTS.md §5](./AGENTS.md#5-pull-requests-and-releases)); a reviewer's "while
you're here, it should also …" is a second one. Do not fold it in, and do not
drop it: **find or file a `todo/` issue to investigate the feature**, next to
the code it describes ([todo/README.md](./todo/README.md)), and reply with a
link to it. Search first, as before any other work — the request may already be
tracked, in which case the answer is that issue plus whatever the review just
added to it, not a second record of the same thing. That issue is the honest
answer — the request is worth considering, it has not been considered yet, and
the investigation is what decides whether it ships at all. Adding a new file to
the pull request under review is fine when the file is all that it adds;
otherwise file it separately, so this pull request stays one change.

## 3. A reviewer turned one case into a universal rule

"Always fix a crash inside what the feature claims to support", "always open a
new issue", "never ship a limit" — each is one real situation written as though
it covered every other. The situation behind it is usually genuine; the rule is
what fails. Applied to the case the reviewer did not have in view it forces
work that buys nothing, and once it is written down everyone who reads it
repeats it. Answer with the case that breaks it — the internal script whose
128 KB limit nobody can reach settles more here than any argument about the
principle — and then say **what the decision actually depends on**: who runs
this code, which inputs are real, what the `todo/` tree already holds. Those
are things the author is looking at and the reviewer is not, which is why the
call stays with the author. Record the dependency rather than the exception, or
the next reader proposes the same rule again.

## 4. Deferring a defect

A comment saying the change is **wrong** is not automatically this pull
request's work either. Even a known edge case that crashes the program may be
deferred, and by the criterion above it often should be: a pull request that
grows a fix for every defect a reviewer can name stops converging, and
everything it learned goes with it when it is abandoned.

What makes that push-back legitimate is the same thing as in the three cases
above — **the `todo/` issue has to carry the knowledge** rather than a shrug:
what crashes, the input that triggers it, and whatever the reviewer or the
author already knows about why. A crash recorded that precisely is a scoped
next step someone can pick up; the same crash left in a review thread is a bug
nobody can find again. What may not be deferred is a **regression** — something
that worked before this pull request and does not after. A step forward that
carries a known limitation is progress; a step that takes working behavior away
is not, whatever is filed alongside it.

How far a crash may be deferred depends on **what the software is and whether
the input is real** — not on whether the crash falls inside what the change
claims to do. An internal script that generates our own website, found not to
handle a file above 128 KB, is a documented limit and a `todo/`: the only
people who can hand it a file are the people who maintain it, no such file
exists, and the day one does is the day the issue gets picked up. [DESIGN.md
§1](./DESIGN.md#1-simplicity-first) already treats a limit a later generic
improvement can lift as an acceptable interim answer, and this is one. A module
that ships in the published package is the opposite case: the input belongs to
someone we have never met, "no such input exists" is not something we are in a
position to know, and a crash inside what the module claims to support is fixed
before it lands. In between, ask who runs this, what they can hand it, and what
it costs them when it breaks — then write that answer into the `todo/`, so the
deferral is a judgement on record rather than an omission.

## 5. Refusing loudly

Whichever end of that range you are at, a deferred limit has to be a **loud**
one. An unsupported input that crashes is visible, reproducible, and dated by
the `todo/` that says when it will be handled. An unsupported input that
returns a plausible wrong answer is not deferrable at all — making it fail is
this pull request's work. Support can wait; silence cannot.

Which kind of loud is a design question, and [DESIGN.md
§10](./DESIGN.md#10-refuse-what-you-cannot-handle) answers it: an input a
caller may legitimately supply and is expected to cope with — an oversized
buffer, a malformed document — is **rejected**, as a `try*` returning
`Nullable<T>`, and only a violated precondition is a **panic**. In code this
pull request is adding, that is settled here: shipping a new API that panics
where §10 calls for a rejection is a design defect, and a reviewer pointing it
out is right. Mitigating a defect found late is the case that may be staged —
an assert stops the wrong answers today, while turning it into a `try*` changes
the signature and every call site — but then the `todo/` has to say that the
rejection is what it owes, or the interim shape quietly becomes the design.

The refusal is a mitigation, so the `todo/` it leaves behind is queued work and
not a decision: mitigate fast, file the issue, then fix it. If the limit later
turns out to be one worth keeping, that is a won't-fix — document it where the
API is documented and delete the issue, as
[todo/README.md](./todo/README.md) requires, rather than leaving a stale one to
imply a fix is still coming.

## 6. Where the knowledge lives

So the question to ask about a review comment is not "is this in scope" but
**"where does this knowledge live once the pull request is merged?"** In the
diff — then fix it here. In the design document, or in a `todo/` issue — then
write it there, and reply with the link. Only "in the review thread" is the
wrong answer; that is the one place it will not survive.

And when the honest answer is "nowhere, because this pull request is never
going to land" — the design was wrong, the approach does not work, the review
turned up more than the change can carry — then **change what the pull request
is**. Drop the code and keep what it taught: a rewritten `todo/`, a design
document recording the approach that failed and why, a note in the module's
`README.md`. Merge that. A pull request that lands three paragraphs nobody has
to rediscover has done more than one that closes after a hundred comments with
no diff at all.

## 7. When the design does not survive implementation

The same holds once a design leaves review and someone implements it: a `todo/`
that cannot be implemented the way it describes is rewritten, never forced
through ([DESIGN.md §3](./DESIGN.md#3-design-before-implementation)). A
reviewer holding the code to that design is answered with what does not work,
not with a workaround.
