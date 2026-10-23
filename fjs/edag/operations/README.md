# Operations

The dispatcher both interpreters share: given an operation node, it demands
the node's operands from the interpreter and applies the operation from
[`../value`](../value/README.md). [`module.f.mjs`](./module.f.mjs) holds it.

An interpreter supplies two things: how to evaluate an operand, and how to
invoke a function. [`memo`](../memo/README.md) evaluates an operand through
its cache, and [`amnesia`](../amnesia/README.md) evaluates it again. The
dispatcher threads that interpreter's immutable state through in evaluation
order and never turns a represented value into a host value, so both
interpreters answer through the same code.

|Export                     |Does                                                                    |
|---------------------------|------------------------------------------------------------------------|
|`operation`                |dispatches one operation node                                           |
|`invokerWith`              |builds an interpreter's `invoke` from how it evaluates a body           |
|`staticCall`, `intrinsicCall`, `entryCall`, `hasEntryCall`|the calls of statics, intrinsics and the `entry` helper|

**Tail position is decided here.** A call whose value would be the node's own
(a bare `()`, the last call of a chain, the selected arm of `?:`, the last
operand of `,`) is prepared and handed back for the interpreter to make in the
current invocation's place. That is what lets a function that iterates by
calling itself last run in constant host stack in both interpreters.
