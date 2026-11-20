## Write a capture as the name it captures

**Priority:** P3
**Status:** open

### Problem

A function that captures a binding is written with a `const` of its own for
it at the head of the body:

```js
const $4=($5)=>{const $6=$0;const $7=$2;return $5[0]==="ok"?$6($5[1]):$7($5[1]);};
```

where source would read `$0` and `$2` directly. Each alias is a declaration
run on every call. In `fjs compile fjs/compiler/edag/module.f.js out.f.js`,
9,131 of the 17,170 `const`s written are such aliases, about 135 KB of a
719 KB file.

### What is not known

Why the writer spells a capture this way has not been established, and a
change here has to keep the round-trip law of
[`fjs/compiler/serializer`](../../../../compiler/serializer/proof.f.js): a
written module reads back as the graph it was written from. Two things the
alias may be holding, to check before removing it:

- **Slot order.** The aliases are declared in the order of the function's
  frame slots. Written without them, the order the reader gives the slots
  is whatever it derives from the body, which may differ.
- **A capture that is not a name.** A capture's value is evaluated where the
  function is made. Only one that is a reference to a binding in scope
  there can be read in place.

### Tasks

- [ ] Establish what the reader derives a function's slot order from.
- [ ] Write a capture that is a reference to a binding in scope as that
      name, where the slot order read back is the one written.
- [ ] Report the size of the written compiler before and after.
