# One task, one session

For whoever takes one task from its `todo/` to the last pull request merged —
an agent session or a person at a keyboard, the word *session* covers both. What
a pull request owes on arrival is
[CONTRIBUTING.md](../CONTRIBUTING.md#opening-a-pull-request); what to do with
the comments it gets is [REVIEW.md](./REVIEW.md); the principles are
[DESIGN.md](./DESIGN.md).

**Nothing is decided alone.** The session proposes; the task owner decides.
At every step below, a question or a proposal is the expected output, and a
decision made silently is the one thing this document forbids. A question is
not a delay: the work that does not depend on the answer goes on, and the
answer, once given, is written where it survives — the `todo/`, the design
document, the pull request description — never only in the thread
([REVIEW.md](./REVIEW.md)).

A task ships as a **stack**: small pull requests, each on top of the previous,
each reviewable on its own and merged in order. One session carries the whole
stack, from the `todo/` to its deletion —
[#1925](https://github.com/functionalscript/functionalscript/pull/1925) and
[#1927](https://github.com/functionalscript/functionalscript/pull/1927) are two
steps of one, and the open stacks in the tree at any time show the shape.

## The loop

1. **A small pull request with the tasks.** File the `todo/` for the task, or
   grow the one that exists: the problem, the proposal as far as it is known,
   and a **Tasks** list of concrete steps
   ([todo/README.md](../todo/README.md#issue-format)). The step is the unit
   of the list and the pull request is the unit of landing: a pull request
   takes one or more steps, one feature's worth, and a step that is only a
   check — `tsc` clean, the suite passing — lands with the step it checks,
   never alone. This is the design increment
   ([DESIGN.md §3](./DESIGN.md#3-design-before-implementation)), and it
   carries no implementation — a prototype only where nobody yet knows
   whether the design works, and then marked as one
   ([REVIEW.md](./REVIEW.md#designs)). That is §3's preference, not a rule
   it lacks: where the design change is a one-line correction the code makes
   obvious, and splitting costs more than it returns, the first pull request
   is the implementation with the correction in it, and its description says
   both are there. It is opened against `main`, and it is where the first
   questions go: what the
   `todo/` leaves open, and which of those the owner wants settled before code
   is written.
2. **The next pull request, on top.** Branch from the previous pull request's
   branch and open the pull request **against that branch**, not `main`, so
   its diff shows only its own step. It takes the next step or steps from the
   list — one feature, minimal change, every check passing — and its
   description starts with what it stands on: `Stacked on #NNNN`. It ticks
   what it took in the `todo/`; the pull request that takes the last step
   deletes the file ([AGENTS.md §1](../AGENTS.md#1-workflow)). Before starting
   it, propose: which steps next, and whether the list is still right now that
   the previous pull request is built — a step it made unnecessary is removed,
   one it revealed is added, and both are the owner's call.
3. **Update the branches and answer the comments, for every pull request in
   the stack.** When `main` moves, or a lower pull request changes, merge
   upward: `main` into the lowest branch, then each branch into the one above
   it, in order. Merge commits only — a rebase would rewrite what a reviewer
   has already read and what the lower pull request is about to land
   ([CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages)). Comments are
   answered per [REVIEW.md](./REVIEW.md), on the pull request where they were
   made: a fix on a lower branch reaches the ones above through the merge, and
   is never made twice. A comment on a lower pull request that changes the
   design changes the `todo/` first, and every pull request above it is
   re-read against the new text before anything else is pushed — this is the
   step where a stack most needs the owner: say what the comment changes for
   the steps above, and ask before rebuilding them.
4. **The lowest pull request is approved: queue it.** When the lowest pull
   request is approved and green, add it to the merge queue — CI runs on
   `merge_group` for this ([`fjs/ci`](../fjs/ci/README.md)) — and do not merge
   any other. Once it lands, retarget the pull request above it to `main`: its
   base was the merged branch, and since merged branches are kept, GitHub does
   not retarget it by itself. Its diff should still show only its own step,
   which the merge commits guarantee; if it does not, something above was
   built on a lower branch that then changed, and that is a question for the
   owner, not a force-push.
5. **While tasks remain, go to step 2; otherwise, go to step 3 until every
   pull request in the stack is merged.** The last task's pull request is not
   the end: the stack above the merged one still has branches to update,
   comments to answer, and a lowest member to queue, and steps 3 and 4 repeat
   until it is empty. The task is done when its last pull request, the one
   that deletes the `todo/`, has landed. It is also done when the owner says
   so; and it pauses, rather than guesses, when the next step needs a
   decision nobody has made.

## What is a decision

Anything the `todo/` leaves open where two implementers would not produce the
same observable behavior and the same API
([REVIEWING.md](./REVIEWING.md#designs-and-todo-files)): a name in the API,
the shape of a type a consumer will see, the order of tasks where the order
matters, whether to deviate from the design and how, how the steps are cut
into pull requests, and whether a corner case is refused, handled, or filed.
Also anything a review reopens, and any choice about the stack itself — its
order, its depth, what is queued — that this document leaves open.

Not a decision: what the documents already say, and what nobody can observe.
Code rules, the proof requirement, the pull request format, and the design
principles are settled, and asking about them is noise
([DESIGN.md §9](./DESIGN.md#9-maximize-signal-to-noise)); an implementation
choice that changes neither behavior nor API is the implementer's room
([REVIEWING.md](./REVIEWING.md#designs-and-todo-files)), and asking about it
is the same noise.

## How to ask

Where the owner will read it and where the answer will survive: the pull
request description for what the step decided and what it left open, a
comment on the `todo/` line for a task in question, and the session itself for
anything that blocks the next step. Propose, do not only ask — one option the
session would take, and the alternatives it would not, with the reason —
and put the answer into the document it settles.
