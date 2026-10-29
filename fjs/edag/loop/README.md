# Loop

Recognizes the established scalar-loop template for common
[`EDAG-to-FAST conversion`](../to_fast/README.md). This compatibility shortcut
preserves its graph and output shape. General tail-call recovery lives in that
conversion; writers render prepared FAST. [`module.f.mjs`](./module.f.mjs)
holds the recognizer.

The one shape it recognizes is a function of one state value whose condition
continues it:

```js
['=>', 1, FRAME, ['?:', COND, ['()', ['self'], [NEXT]], ['arg', 0]]]
```

That is `r => COND ? self(NEXT) : r`, the recursive spelling of
`while (COND) { r = NEXT }`. Common conversion recovers the loop before target
preparation and serialization.

|Export              |Answers                                                                |
|--------------------|-----------------------------------------------------------------------|
|`loopOf(a, i)`      |entry `i` of table `a` as a `Loop` (its condition and arms), or `null`  |
|`keepsRecursion`    |matching shapes excluded from this scalar shortcut                     |
|`reaches(a, shared)`|whether an operand reaches one of the `shared` entries in its own scope |

Source JavaScript, runtime function text and Rust share conversion and
preparation. The [source-output contract](../to_fast/source/loops/README.md)
records its additional grammar and normalization boundaries.
