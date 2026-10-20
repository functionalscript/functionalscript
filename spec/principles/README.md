# Principles

**Status:** normative

**Compatibility with JavaScript.** FunctionalScript is a subset of JavaScript,
not a language that resembles it. Every accepted FunctionalScript module must
be valid JavaScript ES module source, including lexical restrictions and early
errors. Check the original text, not text repaired or stripped by a transpiler.
Nothing has to be preprocessed for `node`, `deno`, `bun`, or a browser to parse
a `.f.js` file: the file is already JavaScript.

Source inclusion and the following requirements hold at every development
stage and outrank everything else:

1. code that passes FunctionalScript validation/compilation has no side effects;
2. for the same admitted inputs and dependency environment, successful
   FunctionalScript and JavaScript executions have the same observable result,
   except for explicitly specified semantic exceptions. This includes later
   observations through exported functions, not just the initial module value.

The observable result is the serializable data the program returns. What a
JavaScript engine reports about the *written* output of a compiler — a
function's `name` or its text after the compiler has serialized a module — is the
writer's spelling, not a result of the program, and no compatibility
question: a compatibility issue exists only where the same program returns
different serializable data on a FunctionalScript VM and a JavaScript engine.

The execution profile declares its ECMAScript and host-resolution environment.
An exception names its profile, affected operations and observable consequences;
an identity exception is not an excuse for arbitrary differences in another
profile. Missing support may be refused, but accepted source must not silently
receive a different successful meaning.

Compatibility runs one way only. Every FunctionalScript module is JavaScript;
most JavaScript is not FunctionalScript. So the language is a **whitelist**,
and it whitelists complete semantic patterns rather than individual operations
in isolation. An otherwise-forbidden JavaScript construct may appear as a
component of a recognized pattern that lowers to a FunctionalScript primitive
— the bracketed `__proto__` key ([below](../values/objects.md#the-__proto__-key)) is the current
example.

**Every pattern instruction must be recognized after statement and expression
structure is known.** The parser owns JavaScript's syntax, line-terminator
restrictions and statement boundaries. Pattern recognition operates on that
parsed structure with validated binding relationships; it never reinterprets
source tokens, joins statements or repairs syntax. Syntactic recognition does
not by itself admit a construct into FunctionalScript: the complete pattern
must pass the whitelist, and protected operations cannot escape it.

Outside the explicitly specified exceptions, rule 2 also decides what to do
when JavaScript gives one text a meaning FunctionalScript cannot reproduce:
the text is a compilation error, not an invitation to give it a second,
more convenient meaning. The valid JavaScript the compiler refuses is
catalogued in [refused constructs](../todo/refused-constructs.md), each marked
as refused by design, planned or undecided.

## Function-source representation exception

**Adopted:** in FunctionalScript VM execution, the default string representation
of a function is source reconstructed from its associated EDAG, not the original
source text. Original comments, formatting and identifier spellings need not
survive. This applies to `String(f)` and every admitted indirect conversion
that reaches the same default function representation, including conversions
inside complete instruction patterns. It applies to exported functions too.

Running source directly on a JavaScript engine retains that host's function
representation. Its text can differ from the FunctionalScript VM's, including
when a JavaScript consumer reflects on an exported function. The
ordinary runtime callables produced by runtime compilation are the same case:
they expose their host's function text after EDAG reflection has been erased.
The Memo and Amnesia EDAG interpreters, including compiler module
initialization, retain represented functions and use the shared EDAG-derived
renderer ([`fjs/edag/function-text.md`](../../fjs/edag/function-text.md)). Differences
caused by using that text as a key, comparing it or branching on it are
consequences of this exception, not a blanket waiver for unrelated results.
Non-function conversion, other admitted function observations and source
syntax retain their existing contracts. The exception alone admits no new
syntax or API.

Function text renders code with captured values represented by slot names;
it does not serialize those values or instantiate their frames. Instances
of the same function template have the same text even when their captures differ.
A body reading `self` is rendered as a named function expression — unless
the function is a loop, `r => c ? self(next) : r`, which is rendered as the
loop it is, `let` and `while` over a `let` of its parameter ([loops](../control-flow/loops.md),
[function text](../../fjs/edag/function-text.md)). This text
need not be accepted by the FunctionalScript source parser: the total text
renderer and the structural source serializer have separate contracts
([function text](../../fjs/edag/function-text.md)). The Rust VM also answers
`String(f)`, `f.toString()`, `'' + f` and `[f].toString()` with the compiled
function's EDAG-derived text, and refuses a native function without associated text.
[Function text and serialization](../design/serialization.md#function-text-and-serialization)
tracks the broader serialization design.

## Failure is one outcome

All execution failures are one indistinguishable semantic outcome:

```text
throw A ≡ throw B ≡ memory failure ≡ time failure
```

`throw value;` is the statement that reaches this outcome on purpose
([functions](../functions/README.md)); an operation that fails, `null.x` or `1n / 0n`,
reaches it by accident, and the two are not distinguished.
Error types, messages, stacks, source positions, the first failing operation
and the work performed before failure are not language-level observations.
Operational diagnostics may report a cause, but cannot become program values
that distinguish failures. Syntax rejection remains a compiler property:
accepting invalid JavaScript is not excused by failure equivalence.

```js
const a = null.x;
const b = undefined.y;
export default [b, a];
```

A graph traversal may encounter `b`'s failure first, where JavaScript
encounters `a`'s: both are the one failure outcome, and no source-order
barrier is needed to keep the first.

This deliberately allows reordering failing EDAG computations to fail earlier.
Do not impose source-order barriers, identical evaluation counts or identical
resource thresholds merely to preserve failure behavior. Preserve successful
paths: failure equivalence does not authorize executing an otherwise skipped
failure on such a path or inventing a successful value by deleting a required
failure. Different executors may exhaust different memory or time limits; a
more efficient one may finish where another stops. A stopped run is a failure,
not a guessed result.

When we implement features of FunctionalScript, the first priority is a
simplification of the VM, subject to these requirements.

## Operators and functions

**A built-in is a function or an operator, and only an operator's arguments
are counted at compile time.**

A **function** is a value: `Object.is`, `Number.isSafeInteger`, the
[`entry` helper](../property-access/entries.md), any arrow. A value can be
bound, passed and cached, `const f = Number.isSafeInteger;`, so the compiler
cannot see every call of it, and **no call's argument count is checked at
compile time**. Where the call is made — a guarded call on a nullish callee,
`f?.(x)`, makes none and evaluates no argument
([optional chaining](../property-access/optional-chaining.md)) — every
argument is evaluated, and the function's parameter list binds them, as in
JavaScript: a rest parameter collects the extra ones,
`((...xs) => xs.length)(1, 2)` being `2`, a default fills a missing one
([parameters](../functions/parameters.md)), and otherwise a missing one is
`undefined` and an extra one is ignored, `Number.isInteger(1, 2)` being
`true`.

An **operator** is a construction of the language: `+`, `*`, `typeof`, and the
conversions `Number(x)` and `String(x)`. It is no value, so the compiler sees
every use, and each use takes **a fixed set of operands**, checked at compile
time; any other set is a compilation error. `Number` takes none or one,
`Number()` being `0`, so `Number(a, b)` and `Number(...a)` are refused by
design (`Number takes one argument`), and so are `String`'s. The mistake
the fixed set prevents is a quiet one: `Number(s, 16)` reads as a radix, as
`parseInt(s, 16)`'s is, where JavaScript evaluates the `16` and ignores it,
and `Number(...a)` converts whichever value happens to come first, or
answers `0` where there is none — each a call whose written arguments say
more than the conversion does.

**A word naming a JavaScript object with members of its own is never a
value.** `Number`, `String` and `Object` are such words: in JavaScript each is
a function that is also a namespace, `Number.isSafeInteger` and
`String.fromCharCode`. Were `Number` a FunctionalScript value,
`const x = Number; x.isSafeInteger(5)` — valid JavaScript, `true` there —
would be accepted and read `isSafeInteger` from a plain function, `undefined`,
so the call would fail, which the second requirement above forbids. So each
word is reserved ([global names](../todo/2365-global-names.md)): an operator
where the language calls it, `Number(x)` and `String(x)`, and a namespace of
functions where it reads the members the language admits
([built-in static functions](../built-ins/static-functions.md)). Being no
value, neither has a nullishness to guard: `Number?.(x)` and `Object?.is`
ask nothing, and are refused by design (`reserved word`).

**Adopted:** the language designer, **sergey-shandar**, stated the principle in
[the LLM working session](https://claude.ai/code/session_01Hqrk4Np3kC1KXH2GHwRbwC),
the fixed set of operands included: "If we introduce a command as an
operator, like a language construction (e.g. `Number`, `+`, `*`) then we
require a specific set of arguments at compiler level. … So `Number` and
other complex objects, like `String` are operators, not functions."

## Examples

The compiler demo offers the programs `overview`, `failure` in [`module.f.js`](./module.f.js), each with its real output.

## Reference

- ECMA-262: [ECMAScript language: source code](https://tc39.es/ecma262/#sec-ecmascript-language-source-code)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar>
