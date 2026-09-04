# Reviewing a pull request

For the reviewer of a pull request, human or bot. The author's side is
[REVIEW.md](./REVIEW.md); the principles are [DESIGN.md](./DESIGN.md); what a
pull request owes on arrival is
[CONTRIBUTING.md](../CONTRIBUTING.md#opening-a-pull-request).

**A review's job is to land the pull request** — small, simple, with what it
taught written down. It is not to make the change complete, and not to complete
the design the change builds on. A pull request that grows a fix for every case
a reviewer can name stops converging, and everything it learned goes with it:
the rule [REVIEW.md](./REVIEW.md#deferring-a-defect) gives the author, seen
from the other chair. Deliver fast and simple; the corner cases are decided
later, one `todo/` at a time.

## What to raise

Four things are always worth a comment, because nothing else catches them:

- **A regression.** Something that worked before the change, was meant to
  keep working, and does not after. A declared breaking change is not one.
- **Silence.** An unsupported input answered with a plausible wrong value
  instead of a refusal
  ([DESIGN.md §10](./DESIGN.md#10-refuse-what-you-cannot-handle)). Ask for the
  refusal — an assert is minutes of work — and a `todo/` for the rest.
- **An undeclared breaking change.** Nothing derives one from a diff
  ([CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages)); the release reads the
  declaration to pick a version number.
- **A second feature.** A pull request implements one; the second is a
  `todo/`. Whether an already-combined pull request is split is the
  repository owner's call, and once made it is not reopened on a bot's finding
  ([#1844](https://github.com/functionalscript/functionalscript/pull/1844)).

Beyond those, a comment is worth writing when it names the input that breaks
the code, the rule the change breaks, or the sentence a reader would follow to
a wrong place. The rules no tool enforces — immutability, no `try`/`catch`, no
regular expressions, no file-scope `@typedef`
([fjs/AGENTS.md](../fjs/AGENTS.md)) — are held by review, so a violation is a
finding with the rule as its link. "An implementer following this task builds
against a module the proposal above it retired" is a finding. "This could be
more precise" is not.

**What blocks.** A regression, silence, an undeclared break, and a broken rule
are fixed before approval. Everything else in this document is a `todo/` or an
answer, and never a reason to hold the pull request.

## What to ask for

| You found | Ask for |
| --------- | ------- |
| A corner case the change does not handle | A `todo/` naming the input — not a fix. If the case answers wrong, the refusal first: that is silence |
| A design that leaves a decision open | Nothing, unless two implementers would produce different observable behavior or API; then one sentence in the document, or a `todo/` |
| A plan that prescribes no order or method | Nothing; that is deliberate |
| An improvement that would be nice while here | A `todo/` |
| A rule a tool already enforces (`tsc`, coverage, `clippy`, `fmt`) | Nothing; CI has it |
| A "what if" nobody has asked for, untested | Nothing; a test for it is noise, not proof |
| A type that could reject more at compile time | Nothing on an input the code already accepts; see [below](#type-level-computation) |

A corner case is a case the change did not set out to handle and no real input
reaches today. The answer is a `todo/`, and whether it is ever picked up is
decided later, on its own — not by the pull request that happened to be open
when someone thought of it. A fix for what is not broken is code that has to be
proved, read and kept, for a case that may never arrive
([DESIGN.md §1](./DESIGN.md#1-simplicity-first)).

## Designs and `todo/` files

A design document is allowed to be incomplete. Detail is missing only where two
implementers working from it would not produce the same observable behavior and
the same API ([REVIEW.md](./REVIEW.md#designs)); everything else is the
implementer's room, and a review that fills it is designing in the thread — the
one place the answer will not survive. The migration plan in
[#1870](https://github.com/functionalscript/functionalscript/pull/1870)
answered every "settle X before stage 1" and "fix the order of Y" by removing
a prescription rather than adding one: the stages are numbered for reference,
not for order, and each open question is answered by whoever needs the answer,
when they need it, where they make it.

A pull request that only files a `todo/`, or only grows one, is a change like
any other. Review it for direction and consistency, not for completeness: a
problem statement with no proposal is a valid increment, and so is a proposal
that leaves most of its decisions to the implementation.

What a design review does check: the document does not contradict the code it
describes — a path that does not exist, an importer that does not import — and
it does not contradict itself — a task list still building what the proposal
above it retired. Both are checked against the tree, not against what the
reviewer expects the tree to hold.

## Type-level computation

TypeScript evaluates conditional and recursive types against a hard depth, and a
type that walks a value's shape reaches it: `Ts<T>`, `parse` and `validate` in
`fjs/rtti` all hit TS2589 and pay for it with fast paths, phantom annotations and
boundary casts ([`fjs/rtti/ts/README.md`](../fjs/rtti/ts/README.md#the-problem-ts2589)).
Every check added to a type that walks a value is one more step toward that
depth, and a step spent on an input the code already accepts changes nothing
observable — the runtime already refuses the invalid value, and the valid one
was valid before — so do not ask for one; the simplest type that holds is the
right one whether or not a walk is near the limit
([DESIGN.md §1](./DESIGN.md#1-simplicity-first)). Ask for the simplest type that states the
contract, an `Assert<Equal<…>>` in the proof where the inference matters
([fjs/AGENTS.md §1.4](../fjs/AGENTS.md#14-assert-type-level-facts-with-assertequal)),
and a `todo/` for anything tighter.

## Bots

Bot reviews re-run on every push, and each round finds "fresh evidence" in the
previous round's fix. A bot finding is a bug report: verify it, then treat it
like any other — what [blocks](#what-to-raise) is fixed, the rest is a `todo/`
or an answer, given once — and leave it when the answer is already in a
document or a `todo/`. After the second round, a finding that does not block
gets no push: a `todo/` or an answer, and the pull request lands. A human
reviewer forwards a bot finding only when they would have raised it
themselves, and does not hold approval on an open bot thread.

## Writing the comment

- Lead with the input that breaks it, or the rule it violates, with a link.
- Say what resolves it — a fix, a `todo/`, or a sentence in the document. When
  a `todo/` resolves it, say so, so the author does not guess that a fix was
  wanted.
- One comment per finding. On the next round, check whether it was answered
  rather than restating it.

## When to approve

Approve when what remains is `todo/` work, or the answer is in a document, and
what [blocks](#what-to-raise) is fixed. Open `todo/` files are not a reason to hold a pull request, and neither is a `todo/`
that says less than you would have written: the next person adds what is
missing, in a pull request that need not implement anything
([REVIEW.md](./REVIEW.md#designs)).

Two rounds is normal. A third round of design feedback on the same file means
the review has become design work, and that belongs in a pull request of its
own. What blocks, blocks in any round.
