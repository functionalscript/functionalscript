# Variables

**Status:** implemented

```js
export default (...a) => {
    let n = a[0];
    let [sum, count] = [0, 0];
    sum = sum + n;
    count = count + 1;
    if (n < 0) { sum = -sum; return [sum, count]; }
    n = n * 2;
    return [sum, count, n];
};
```

A `let` declares a **variable**: a name an assignment, `x = value;`, may
rebind. Otherwise it is a `const` under the other keyword — a statement
standing where a `const` stands, in a module, a function body, a guard's or
a case's block and a loop's block, that binds a name or a pattern
([destructuring](../destructuring/README.md)) to the value of its
initializer, evaluated as its own statement whether or not anything reads
it ([constants](../constants/README.md)). The initializer is required, as
a `const`'s is: JavaScript's `let x;`, the variable `undefined` until its
first assignment, is refused by design. A variable names its value where it
is declared, as a body names what it returns in an explicit `return`
([bodies and guards](../../control-flow/guards/README.md)); a declaration
that names none asks the reader to find the first assignment on every path,
and this compiler tracks no such thing, so it admits no program that needs
it ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
Write the value the variable starts from, `let x = undefined;` where that is
what is meant. A later proposal may admit the declaration where every path
assigns the variable before a read, `let x; if (c) { x = 2; } else { x = 3;
}` as `const x = c ? 2 : 3`
([definite assignment](../../todo/3225-definite-assignment.md)). The name is a name of the body as
a `const`'s is: it takes the words a `const` takes, bound twice is
`duplicate id`, read in its own initializer or before its declaration
`const not found`, and from outside a nested function it is a capture. A
parameter is a variable too, fixed or rest.

A declaration pattern initializes each of its bindings once; defaults and
destructuring do not count as assignments. Destructuring assignment without a
declaration, such as `[a, b] = values;`, remains a separate language extension.

- **An assignment**, `x = value;`, rebinds the variable for the statements
  after it, in order, as JavaScript reads them: `let r = 0; r = r + n; r =
  r * 2; return r;` returns `(0 + n) * 2`. It is a statement, ended as
  every statement is, and no value of the language: `a = b = 1;`,
  `f(a = 1)` and `o.a = 1;` are refused where their `=` stands
  ([refused constructs](../../todo/refused-constructs.md)). The value is
  established for what it does, as a `const`'s is, even where the next
  assignment overwrites it before any read: `r = null.x; r = 1;` throws.
- **Only a variable is assigned.** An assignment to a `const`, to an
  import or to the name a function is declared under is refused
  (`assignment to const`): JavaScript throws there, at run time, and this
  compiler names the slip where it is written.
- **A variable denotes a sequence of values, not a cell.** Each assignment
  establishes a fresh immutable value, and a read is a read of the latest;
  no node of the graph holds a variable, so the graph outputs write the
  values: `let r = 0; r = r + n; return r;` is the graph `n + 0` is. A
  terminating guard never rejoins its returning arm. A
  [normally completing conditional](../../control-flow/guards/README.md#normally-completing-conditionals)
  may assign one outer binding across its arms: following statements read
  the selected arm's latest version, or the incoming version when that arm
  leaves it unchanged. Branch-local declarations stay local. A loop
  ([loops](../../control-flow/loops/README.md)) can carry several variables
  read or assigned by its condition and body.
- **A reassigned variable is captured by no function held as a value.** A
  function nested in the variable's scope — a `const`, an item, an
  argument, a value returned, a condition — may not read or assign a
  variable that is assigned anywhere in that scope, whether the assignment
  comes before or after it (`reassigned variable captured`): JavaScript's
  closure sees the variable's last value, where the function's capture
  holds the value it had when the function was made, so the program is
  refused rather than read another way. Two spellings say what is meant:
  a function called where it is written, `r = (() => r + 1)();`, reads
  the value of that moment in both languages and is admitted, through any
  depth of such functions. An immediate call that normalizes to an expression
  block may also assign the variable: the block returns the updated binding
  versions to its continuation, as described below. A **snapshot**,
  `const s = r; return () => s;`, holds what
  the capture would hold, as a `const` does. A variable
  never assigned is captured as a `const` is: a `let` nothing assigns and
  a parameter nothing assigns are a `const` by another spelling, and the
  rule is one for both — a function that is a variable's whole value names
  itself, `let f = n => n ? f(n - 1) : 0;`, as a `const`'s does, the name
  a capture the rule refuses the moment the variable is assigned anywhere.
- **The scope is the block.** `let` is not hoisted and has no `var`:
  `var` is refused ([`var`](../var/README.md)). A module's `let` is a
  variable of the module, which is a function
  ([module structure](../../modules/README.md)), under every rule above;
  an export is a `const`, so `export let` is refused
  ([`export let`](../../modules/export-let/README.md)). A loop can step several
  variables, at module level as well as in a function body
  ([loops](../../control-flow/loops/README.md)).

## Compound assignments

A compound assignment is an assignment statement to a mutable identifier,
under the same declaration, capture and statement-termination rules as `=`.
Arithmetic and bitwise forms reuse the corresponding binary operation:

```js
let n = 8n;
n >>= 1n; // n = n >> 1n
n += 2n; // n = n + 2n
```

The eager forms are `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `<<=`, `>>=`,
`>>>=`, `&=`, `^=` and `|=`. Read the current target value first, evaluate
the right operand once, apply the existing binary operator, then establish
the new value. Existing string, Number and BigInt semantics and failures
apply without new coercions: `+=` can concatenate strings, and `>>>=` still
does not shift a BigInt.

Logical assignments read the target before deciding whether to evaluate the
right operand and write:

| Form | Evaluate and assign the right operand when |
| --- | --- |
| `a &&= b` | `a` is truthy |
| `a \|\|= b` | `a` is falsy |
| `a ??= b` | `a` is `null` or `undefined` |

The skipped path performs neither a right-operand evaluation nor a write,
preserving the existing value and identity. On the selected path, assign the
right operand's value without converting it to a boolean. `a ??= b` differs
from `a = a ?? b`, which always writes; similarly for `&&=` and `||=`.

Targets remain mutable identifiers, including where a logical write would be
skipped. Thus `const a = 1; a ??= 2;` is refused by the static assignment rule,
although JavaScript can execute it without writing. Every source operand is
checked before desugaring, including an unreachable right operand, and a held
closure over a potentially reassigned binding is refused even if the logical
write is never reached. Property mutation and assignment expressions, such as
`o.a += 1` or `f(a += 1)`, remain refused. Prefix and postfix updates are
separate constructs and remain outside the language.

Compound syntax is expanded by source desugaring into the existing binary
operations and immutable binding versions, with conditional regions for the
logical forms. No compound-assignment node reaches EDAG or the VM, and a
serializer may write the expanded spelling.

## Capture compatibility

General bindings replace the earlier treatment of a loop's final variable as an
implicit `const`. A binding reassigned anywhere in its source scope stays mutable
for capture admission, including after its last assignment or loop. A held
function that captures it is refused even if the assignment follows the capture
or appears in an unreachable loop. These source facts are checked before
optimization.

Capture an explicit snapshot instead:

```js
export default n => {
    let value = 0;
    while (value < n) { value = value + 1; }
    const snapshot = value;
    return () => snapshot;
};
```

A snapshot holds the same value without cloning an object. Object-content
mutation has its own [mutability design](../../design/mutability.md).

A never-reassigned `let` or parameter remains capturable. A function called
where it is written can read a reassigned binding, through nested immediate
calls as well. A direct call that normalizes to an expression block can also
write an enclosing binding. This does not permit a held closure over a mutable
binding, or a write across an ordinary invocation boundary that is retained.

## Expression block assignments

An expression block runs in its surrounding execution region. An assignment
inside it establishes the latest value for later reads, both inside the block
and after the expression has completed:

```js
export default n => {
    const result = (() => { n = n + 1; return n; })();
    return [result, n];
};
```

With `n` equal to `2`, this returns `[3, 3]`. Plain direct immediate calls with no
arguments, no parameter or rest declarations, and no internal return
that requires an ordinary function boundary normalize to these blocks. A
terminal return supplies the block's value.

Operand evaluation stays ordered. In `[n, (() => { n = n + 1; return n; })(), n]`,
the first element holds the incoming value and the last two hold the updated
value. A skipped conditional, logical or optional operand makes no assignment.
A reached loop condition may update a variable even when its result ends the
loop. Assignments to a `const` and captures by held functions remain refused
before optimization, including in unreachable code.

The compiler may serialize an expression block as an immediately invoked arrow
function, including assignments when needed. It may instead spell the same
immutable versions with fresh `const` names. Recompiling the output preserves
the result, required evaluations and shared identities.
Graphs with internal member-lookup queries or shared values established in lazy
regions retain the source writer's existing explicit refusals; their source
profiles are tracked in the
[follow-up](../../../fjs/edag/to_fast/source/todo/block-assignment-source-profiles.md).

## Normalization

Write and capture analysis uses resolved binding identities throughout the
source scope before optimization. A binding is mutable when it is reassigned
after initialization, including a write in an unreachable branch or nested
function. A shadowed name has its own write classification. Destructured
parameters and locals follow the same rules as ordinary bindings.
Source declaration legality is checked before declaration kinds are discarded:
the shared `isMutable` fact does not authorize an assignment to a source
`const`.

After source admission, normalization maps each resolved source binding to its
current immutable FAST value. An assignment establishes a fresh value and
updates that map. Required initializers and assignment computations remain
required even when a later write overwrites their values. Admitted conditional
regions pass the selected current values to their normal continuation; an arm
that leaves a binding unchanged supplies its incoming value, and an abrupt
arm supplies no normal result. The [loop normalization contract](../../control-flow/loops/README.md#normalization-and-output)
defines ordered branch and loop signatures. The shared representation belongs
to the [FAST binding contract](../../../fjs/todo/compiler-vocabulary-and-modularization.md#fast-contract).

Value-producing regions also pass their expression result and updated outer
bindings explicitly. Normalization sequences these updates before subsequent
operands and statements; lazy paths join their selected versions. This happens
in AST-to-FAST normalization, before graph construction, and introduces no
shared mutable cell in FAST or EDAG.

## Design approval

`sergey-shandar` approved assignments in expression blocks and serialization to
that spelling in the
[design session](https://chatgpt.com/local/01a185f1-43c3-7453-babf-5d7d9cc48000).

`sergey-shandar` approved the general binding, capture and loop rules in
[PR #3167](https://github.com/functionalscript/functionalscript/pull/3167#issuecomment-6350745131).
The earlier single-variable `let`/`while` subset was approved in
[PR #2852](https://github.com/functionalscript/functionalscript/pull/2852#issuecomment-6136592213).
The [capture compatibility record](#capture-compatibility) describes the
extension's replacement of the earlier post-loop capture policy.

## Examples

The compiler demo offers the programs `variables` in [`module.f.js`](../module.f.js), each with its real output.

The demo on this page runs [`sample.f.js`](./sample.f.js), this page's
example as a function of one number — two `let`s, one with a pattern, and
assignments in the body and in a guard's block, to the `let`s and to a
parameter — with every output `fjs compile` makes of it: the expression
graph (EDAG), the Rust and the WebAssembly that Rust builds to. Its Run
button calls the default export with `3` and `-2`, as JavaScript and as
WebAssembly, and shows what each call returned or threw.

## Reference

- ECMA-262: [Let and const declarations](https://tc39.es/ecma262/#sec-let-and-const-declarations),
  [Assignment operators](https://tc39.es/ecma262/#sec-assignment-operators)
- MDN: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let>
