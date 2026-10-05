## 47. The compiler should be able to load and run modules as meta-programming.

**Priority:** P3
**Status:** open

The FunctionalScript Compiler should be able to load and run modules as a meta-programming option. When it fails, it should show a good error message similar to a compile-time error.

The [EdagValue design](../../edag/todo/edag-value.md) supplies module execution
into a closed, directly compilable value graph. An unresolved initializer
remains code; executing it after import resolution returns a represented
export object or a language-thrown value. New source-language metaprogramming
APIs remain separate proposals requiring language-design approval.
