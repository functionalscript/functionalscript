## Write a capture as the name it captures

**Priority:** P3
**Status:** open

### Problem

A function that captures more than one binding is written with a `const` of
its own for each at the head of the body:

```js
const $4=($5)=>{const $6=$0;const $7=$2;return $5[0]==="ok"?$6($5[1]):$7($5[1]);};
```

where source would read `$0` and `$2` directly. Each alias is a declaration
run on every call. In the FunctionalScript written for
`fjs/compiler/edag/module.f.js`, more than half of all `const`s are such
aliases, about a fifth of the file.

### Why the writer does it

A function's captures are ordered slots, and the reader gives the slots the
order of first reference in the function's text (`captureSources` in
[`fjs/js/ast/sugar`](../../sugar/module.f.js)). The writer does not choose
the order a body reads its captures in, so it names them in slot order
before the body, and the text reads back with the slots it was written from
([README](../README.md)). A function with one capture has no order to keep
and is already written without the alias.

So an alias is needed only where the body, written with the captured names
in place, would mention them in another order than the slots.

### Proposal

Write the captured names in place where the body's order of first reference
is the slot order, and keep the aliases where it is not.

An experiment that decided this by searching the rendered body for each
name removed about four aliases in five from that module's output and a
quarter of its size, and the shorter text read back as the same graph, byte
for byte in its EDAG document. It rendered each body twice and read the
order off text, neither of which belongs in the writer: the order has to
come from the rendering itself, or from the prepared block in print order.

### Tasks

- [ ] Derive a body's order of first reference to its captures without
      rendering it twice.
- [ ] Write the names in place where that order is the slot order.
- [ ] Report the size of the written compiler before and after, with the
      revision measured.
