# Loose equality

**Priority:** P3
**Status:** open — AST admission approved; FJS lowering remains TODO

The language designer `sergey-shandar` approved parsing `==` and `!=` into AST and deferring FJS support in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

## Contract

Read `a == b` as `['==', a, b]` and `a != b` as `['!=', a, b]` in syntax and resolved source AST, with JavaScript equality precedence and left associativity. Preserve ordinary name and binding checks. AST-to-FAST conversion explicitly refuses every occurrence, including unreachable code, until semantics and lowering are implemented. Do not rewrite either operator to strict equality or strict inequality.

## Remaining work

- [ ] Specify and implement JavaScript-compatible abstract equality and its negation for `!=`, including mixed primitive types, null/undefined, BigInt/Number boundaries and object-to-primitive conversion.
- [ ] Preserve left-to-right, exactly-once operand evaluation and conversion failures.
- [ ] Prove behavior across FJS output paths before lifting the AST-to-FAST refusal.
