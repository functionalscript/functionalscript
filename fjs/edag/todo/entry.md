## Two access nodes: `.` for a known name, `entry` for an object's entry at run time

**Priority:** P2
**Status:** open

### Problem

The preceding `own-access.md` proposal made every access an own read. Exposing
function `name` then led `function-name.md` to add a name operand to `=>` and
a writer pattern to restore names. Both proposals are retired; their history
records why the cost exceeded the value of reading `person.name`.

Enumerable own properties provide a clearer data-entry boundary:
`person.name` can be enumerable, while a function's `name` and `length` are not.
Keep static access and a runtime data-entry read as different operations.
Do not redefine JavaScript's standard own-property operations to implement it.

### Proposal

#### Static access

`['.', a, key]` uses a known name: a literal or a constant resolved by the
compiler. Keep the prohibited-name check static, including `name`, with
`length` allowed. The existing constant-key spellings are `a.b`, `a["b"]`
and `a[0]`; other computed forms remain subject to their own parser work.

The executor reads an own property. Emitted ordinary JavaScript agrees under
the existing standard-prototype realm assumption because prototype names are
refused at the key. `f.name` and `person.name` are both refused here; the
latter has the runtime entry spelling below.

#### Runtime entry read

The source defines a JavaScript function whose meaning is explicit:

```js
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
```

`['entry']` is the proposed nullary node denoting this function of arity `2`.
A use is an ordinary call, `['()', E, ['[]', [a, b]]]`, where `E` denotes
that node. The descriptor remains inside the recognized function body.

| Read | Result |
|------|--------|
| `entry(person, "name")`, `entry([1], "0")`, `entry("abc", "0")` | The enumerable own value |
| `entry(f, "name")`, `entry(f, "length")`, `entry([1], "length")` | `undefined`: own but not enumerable |
| `entry(5, "x")`, `entry(f, "x")`, `entry({}, "x")` | `undefined`: no such entry |
| `entry(o, 0)`, `entry(o, true)`, `entry(o, null)` | Read `"0"`, `"true"`, `"null"` respectively |
| `entry(o, [1])`, `entry(o, {})` | Read `"1"`, `"[object Object]"` under ordinary conversion |
| `entry(null, b)`, `entry(undefined, b)` | Failure, as in the source helper |

Primitive boxing and property-key conversion follow the source helper. Objects
and arrays can invoke user-defined conversion; numeric keys require
ECMAScript's number-to-string conversion, not a host-specific approximation.
An unsupported receiver or conversion must be refused, not silently answered
with a plausible value.

#### Recognition after statements

**Every pattern instruction MUST be recognized at a level where statements
and expressions have already been recognized correctly.** This replaces the
former proposal to recognize `entry` as a fixed token shape before its body
syntax was supported.

Follow [statement-aware AST recognition](../../fsc/parser/todo/statement-aware-intrinsics.md).
The shared parser determines JavaScript statement boundaries, expression
structure and restricted productions. Binding/early-error validation precedes
complete AST-pattern recognition and FJS admission, followed by EDAG lowering.
The matcher does not inspect newlines, perform semicolon insertion or repair
syntax. A newline after `return` cannot be ignored to recover this pattern.

The parser must understand the named parameters, local declaration, return,
optional access and conditional expression inside the helper before recognizing
it. This does not admit those operations independently: a descriptor returned
from the function, another descriptor field read, or an unmatched descriptor
use is refused by the FJS whitelist. Resolve `Object` as the intrinsic namespace,
not a shadowing binding; identifier placeholders preserve binding relationships,
not merely repeated spelling. Do not implement a second parser in the matcher.

A later JavaScript-compatible ASI extension may accept equivalent source with
omitted semicolons. Canonical output may still emit them. Whether semicolons
were explicit is not a matcher concern once the AST is correct.

#### Function identity, output and reflection

Each evaluation of an `entry` definition mints a function identity as `=>` does.
Two definitions remain distinct in the JS-compatible profile. The function
may be exported, passed as an argument, or shared in `[entry, entry]`; the
writer must hoist shared definitions as needed and preserve arity `2`.

The previous draft already identified a function-text difference: native
canonical graph rendering and JavaScript's authored function text need not
agree. It is an unresolved **P1 compatibility gate**, not permission to
normalize the source first and call it compatible. `entry(o, f)`, `entry(o,
[f])`, and user-defined conversion can expose the difference as a property
lookup; the `entry` function itself can also be converted to text.

[Function serialization](../../../spec/todo/serialization.md) and the
[compatibility epic](../../../todo/fjs-javascript-compatibility.md) own that
contract. Preserve any admitted observation, or restrict it through compatible
source patterns; no canonical-function-text exception is approved here. Do
not ship incompatible coercions while waiting for that decision.

#### Enumerable presence, not `Object.hasOwn`

**`Object.hasOwn` is prohibited in FJS source, not redefined.** The
[enumerable-presence proposal](../../../spec/todo/2345-has-own-property.md)
replaces direct standard-call recognition with an explicit descriptor pattern,
working name `hasEntity`:

```js
const hasEntity = (a, b) =>
    Object.getOwnPropertyDescriptor(a, b)?.enumerable;
```

That exact source yields `true`, `false` or `undefined`. A boolean-only API
must explicitly use `=== true`; the linked TODO records the remaining API
choice. Neither alternative confuses a property's value with enumerability:
`{ a: undefined }` still has an enumerable `a`. An `entry` value read cannot
distinguish it from absence, but a presence operation can.

`Object.getOwnPropertyNames` and `Object.getOwnPropertyDescriptors` also stay
outside the admitted reflection surface; do not redefine them over entries.
`getOwnPropertyDescriptor` is available only inside complete approved patterns,
not as a descriptor-producing value API. Align the
[built-in plan](../../../spec/todo/2360-built-in.md) with this restriction.
Existing host implementation helpers are not source-language admissions.

`Object.keys`, `Object.entries` and `Object.values` describe enumerable data;
any further source restrictions belong to their own plans. This proposal does
not silently remove the filtering restrictions in the undefined-property TODO.
Likewise, it does not assert universal equivalence between `{ a: undefined }`
and `{}`: the [observation constraints](../../../spec/todo/1010-undefined-property.md)
apply through composition.

#### Boundaries and native execution

An unknown runtime `a[b]` stays refused: JavaScript walks prototypes there, so
it cannot lower to `entry`. The explicitly written helper is the runtime-key
source form. Restricting `name` through `.` and reading data entries through
`entry` does not by itself close all indirect function reflection.

The existing internal `['own', a, b]` operation is planned to implement the
entry read, not a second source spelling. The compiler emits the `entry`
function and its ordinary calls; the writer refuses the internal `own` form.
Changing that operation's semantics requires updating both executors, its
schema documentation, the conformance corpus and generated Rust vectors in
the same implementation PR. Do not change an existing internal opcode silently.

The [native corpus](../../nanvm/module.f.mjs)'s `ownCases` currently pins the
operation. Primitive-key conversion needs no user call; object/array conversion
may need one. Until native calls exist, explicitly refuse unsupported keys
instead of pretending conversion found no entry. Native callable support and
call-shaped conformance cases land with the necessary execution support.

Number conversion follows ECMAScript `Number::toString`: `1e21` names
`"1e+21"`, `0.1` names `"0.1"`, and `-0` names `"0"`. These belong in the
shared corpus. Arity, per-definition identity and actual use as a callable
need tests in addition to direct internal-operation tests.

### Tasks

- [x] Replace the fixed-token bypass with mandatory statement-aware AST matching.
- [x] Prohibit `Object.hasOwn`; direct presence to the separate enumerable pattern.
- [x] Retire `own-access.md` and `function-name.md`; history holds their designs.
- [ ] Add `['entry']` to the schema and document the function/internal-operation
      distinction, subject to the P1 compatibility gates above.
- [ ] Implement recognition only after the shared syntax/binding pipeline can
      represent and validate the complete helper body; keep protected uses
      outside matched patterns refused.
- [ ] Implement the JavaScript and native operation changes together with the
      corpus, generated vectors and documentation. Refuse unsupported calls
      or key conversions rather than invent results.
- [ ] Add a writer spelling from every supported value position, preserving
      sharing, identity and arity. Resolve the function-text observation gate
      before admitting conversions that expose incompatible text.
- [ ] Test objects, arrays, strings, primitives, functions, missing entries,
      undefined-valued entries, non-enumerable properties, nullish failures,
      coercion, binding shadowing, statement boundaries and equivalent layouts.
- [ ] Reconcile the property-access and built-in plans with this complete AST
      pattern; no raw-token shortcut and no redefined standard reflection API.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100% with the implementation.

### Related

- [Statement-aware intrinsics](../../fsc/parser/todo/statement-aware-intrinsics.md).
- [Enumerable presence](../../../spec/todo/2345-has-own-property.md).
- [Property access](../../../spec/todo/2330-property-accessor.md).
- [Built-ins](../../../spec/todo/2360-built-in.md).
- [Amnesia](../amnesia/README.md) — the existing internal read.
