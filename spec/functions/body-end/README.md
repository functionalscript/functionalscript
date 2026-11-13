# Function Fallthrough

**Status:** implemented

A function that reaches the end of its body returns `undefined`, as in JavaScript.
FAST normalization adds that return only to a normally completing path. Terminal
branches and unconditional loops need no fallback return.

See [bodies and guards](../../control-flow/guards/README.md) for the completion contract
and language-design approval.
