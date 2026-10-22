# What the readers assume of a value

**Status:** implemented

The readers are written for **DataJS values**: plain arrays and objects of
primitives, the values FunctionalScript itself can build. Reading a member of
one of those has no effect, and every guarantee the readers make rests on that.

This is the language's assumption, not one the readers add.
[`fjs/AGENTS.md`](../../../../AGENTS.md) §3.1 "One realm, one prototype chain"
says a value an `.f.mjs` function sees was built by this realm's constructors,
and §1.6 says the readers are not proven against anything else. A value
carrying a getter, a `Proxy` trap or a replaced prototype is not such a value,
and keeping one from reaching a reader is the host boundary's job — the thin
`.mjs` that converts a foreign value before any `.f.mjs` sees it — not a
defence each reader re-implements.

So the readers ask each question once and trust the answer: a container's
shape is settled before its members are read, a tuple's positions are its own
indices below `length`, and nothing is re-asked afterwards. Defending against
values the language cannot produce cost speed on every value it can
([`common`'s README](../../../common/README.md#the-members-a-value-carries)
has the measurement).

What holds for any DataJS value:

- a reader returns a `Result` rather than throwing ([errors](../errors/README.md));
- the three readers agree ([`parse` and `validate`](../parse-and-validate/README.md));
- `validate` hands back the value it was given rather than a reconstruction.

A caller holding genuinely untrusted JavaScript should convert it to DataJS
first — or parse from text, where
[`rtti-parse`](../../../../media/json/todo/rtti-parse.md) reads against a
schema in one pass with no intermediate value at all.

## Examples

This page has no demo of its own: every value the demo can read is a DataJS
document, so it has no other kind to show. The
[closed containers](../../schemas/closed-containers/README.md#inherited-members)
page states what the assumption means for members a prototype supplies.

## Reference

- [DataJS](../../../../../spec/datajs/README.md): the values the readers read.

## Where it is implemented

Nowhere, by design: no reader checks for a getter, a `Proxy` or a replaced
prototype. The proofs in [`parse`](../../../parse/proof.f.mjs) and
[`validate`](../../../validate/proof.f.mjs) use DataJS values only.
