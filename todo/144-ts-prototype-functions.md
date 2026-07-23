# 144. TypeScript proposal: distinguish prototype member functions from free functions.

**Priority:** P3
**Status:** open

TypeScript proposal: distinguish prototype member functions (which require `this`) from free functions. For example, `Array.push` can only be called as `array.push(5)` — detaching it with `const p = array.push; p(5)` is a runtime error because `this` is lost. TypeScript currently types both forms identically and does not prevent the detached call. The proposal is for TypeScript to track whether a function captures `this`, and reject uses where `this` would be unbound.
