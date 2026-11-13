# Unary plus

**Priority:** P3
**Status:** open — syntax AST admission; AST-to-FAST lowering remains TODO

The language designer `sergey-shandar` approved unary `+` AST admission and explicitly deferred lowering in the [working session](https://chatgpt.com/local/01a19f43-23cd-76b0-9836-c24644dc8019).

## Contract

Admit unary `+` in the syntax and resolved source AST as `['+', operand]`, distinct from binary addition by arity. Preserve JavaScript prefix precedence, including `a[+x]`, nested prefixes and the prohibition on unparenthesized unary expressions to the left of `**`. Keep name and binding checks. AST-to-FAST conversion must explicitly fail for every unary-plus occurrence, including unreachable source, until lowering is implemented; dependency discovery may still read these files.

## Why

Unary `+` gives a short numeric conversion where the input is not a BigInt, for example `a[+x]`. It is not interchangeable with `Number(x)`: JavaScript's unary `+` throws for BigInts, while `Number(1n)` succeeds. Reusing Number's lowering would silently change that behavior. Adding a second numeric conversion spelling and its failure semantics is a cost worth stating explicitly.

## Remaining work

- [ ] Specify and implement lowering with JavaScript-compatible ToNumber behavior, including rejection of BigInts (also those obtained through primitive conversion).
- [ ] Preserve operand evaluation exactly once, failure ordering, signed zero and NaN.
- [ ] Audit and enable the existing FAST/EDAG numeric operator paths, with cross-output proofs, before lifting the conversion refusal.
