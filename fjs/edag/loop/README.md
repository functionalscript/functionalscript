# Loop

Recognizes a loop written as recursion, so every writer can spell it as a
loop. V8 and Rust implement no tail calls, so a function that iterates by
calling itself overflows the stack on every target except a VM that has them.
[`module.f.mjs`](./module.f.mjs) holds the recognizer.

The one shape it recognizes is a function of one state value whose condition
continues it:

```js
['=>', 1, FRAME, ['?:', COND, ['()', ['self'], [NEXT]], ['arg', 0]]]
```

That is `r => COND ? self(NEXT) : r`, the recursive spelling of
`while (COND) { r = NEXT }`. A writer that sees it writes the `while`.

|Export              |Answers                                                                |
|--------------------|-----------------------------------------------------------------------|
|`loopOf(a, i)`      |entry `i` of table `a` as a `Loop` (its condition and arms), or `null`  |
|`keepsRecursion`    |the shapes every writer keeps as recursion even though they match      |
|`reaches(a, shared)`|whether an operand reaches one of the `shared` entries in its own scope |

There is one recognizer for every writer, so the JavaScript text, the source
writer and the Rust writer agree on which functions are loops.
[`todo/tail-call-loop.md`](../todo/tail-call-loop.md) has the design.
