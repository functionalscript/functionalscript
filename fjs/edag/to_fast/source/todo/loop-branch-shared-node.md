## Write a loop whose branches share a node as source

**Priority:** P2
**Status:** open

### Problem

An accepted module can fail when written back as FunctionalScript. This one
has no imports:

```js
export default head => {
    let tail = null
    while (true) {
        if (head instanceof Array) {
            head = [head]
        } else if (head !== null && 'head' in head) {
            tail = [head.tail, tail]
            head = head.head
            continue
        }
        if (head !== null) { return [head, tail] }
        if (tail === null) { return null }
        head = tail
        tail = null
    }
}
```

```sh
./dev.sh npm start compile input.f.js output.f.js
```

The output is refused with
`a shared node reached from outside the lazy operand that establishes it`.
The shape is `next` in [`types/list`](../../../../types/list/module.f.js),
so every program that reaches that module is refused, `fjs/module.f.js`
among them. Dropping the `'head' in head` test, or the second `return`,
lets the loop through.

[Block-assignment profiles](./block-assignment-source-profiles.md) reach the
same refusal through spreads and stacked switch labels; whether one recovery
answers both is open.

### Tasks

- [ ] Find which shared node the placement leaves lazy here, and why the
  smaller loops are placed without one.
- [ ] Write the loop as source, or state why it stays refused.
- [ ] Prove the input above, and `fjs/types/list/module.f.js`, through the
  source round trip.

### Related

- [Source output admission](../module.f.js) — `lazyReason`, which refuses it.
