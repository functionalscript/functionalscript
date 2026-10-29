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
  guard's block ends in a terminator ([bodies and guards](../../control-flow/guards/README.md)),
  so the assignments in it are that block's own, and the statements after
  the guard read the values the body established before it — the one way
  two branches rejoin is the loop ([loops](../../control-flow/loops/README.md)),
  which carries the variables its condition and body read or assign.
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
  depth of such functions — reads alone: an assignment from inside it,
  `(() => { r = 1; return 0; })();`, is refused the same way, since the
  compiler inlines such a function's block with values of its own, which
  the scope around it never sees, where JavaScript's assignment reaches the
  variable; and a **snapshot**, `const s = r; return () => s;`, holds what
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

A never-reassigned `let` or parameter remains capturable. A function called
where it is written can still read a reassigned binding, through nested
immediate calls as well. Assigning to an outer binding from inside such a
function remains refused. This read admission is retained; it does not allow a
held closure over the mutable binding.

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
