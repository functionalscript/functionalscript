# Built-in prototype names

The names JavaScript finds on a built-in prototype, and what a
FunctionalScript module may do with each. [`module.f.mjs`](./module.f.mjs)
holds the lists — `prototypeNames`, the union of the seven prototypes, and
its partition into `prohibitedCalls` and `allowedCalls` — and the compiler
([`fjs/fsc/parser`](../../fsc/parser/module.f.mjs)) applies them; this table
is the same data with the reason for each row.

Two rules, both by name alone, since the receiver's type is unknown at
compile time:

- **Read** (`a.x`, `a["x"]`): every prototype name is refused but `length`,
  which an array, a string and a function own, so the read agrees with
  JavaScript. A detached built-in is a function that only fails, so the
  language never has one as a value, and the VM needs no prototype.
- **Call** (`a.x(...)`, and `a?.x(...)` once the grammar spells it): a name
  in `prohibitedCalls` is refused; every other prototype name but `length` is a
  member function the VM answers by the receiver's type, and `length`, which
  a value owns, is a call of what the value holds. An own property of the
  name on an object shadows the built-in, a type without the built-in throws
  the `TypeError` JavaScript throws, and a nullish receiver throws before the
  arguments are evaluated.

✅ means allowed and ❌ prohibited. The lists are ECMAScript 2025's, Annex B
included, string keys only; they grow with the language's types — `Map` and
`Set` would add their prototypes here.

| name | read | call | where, why |
|---|---|---|---|
| `__defineGetter__` | ❌ | ❌ | Object. Annex B. Mutates an object. |
| `__defineSetter__` | ❌ | ❌ | Object. Annex B. Mutates an object. |
| `__lookupGetter__` | ❌ | ❌ | Object. Annex B. Prototype reflection. |
| `__lookupSetter__` | ❌ | ❌ | Object. Annex B. Prototype reflection. |
| `__proto__` | ❌ | ❌ | Object. [object Object] |
| `anchor` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `apply` | ❌ | ❌ | Function. Passes `this`, which no function here reads. |
| `arguments` | ❌ | ❌ | Function. Annex B. Data property, throws in strict mode. |
| `at` | ❌ | ✅ | Array, String. Pure element or code unit read, negative from the end. |
| `big` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `bind` | ❌ | ❌ | Function. Fixes `this`, which no function here reads. |
| `blink` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `bold` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `call` | ❌ | ❌ | Function. Passes `this`, which no function here reads. |
| `caller` | ❌ | ❌ | Function. Annex B. Data property, throws in strict mode. |
| `charAt` | ❌ | ✅ | String. Pure code unit read. |
| `charCodeAt` | ❌ | ✅ | String. Pure code unit read. |
| `codePointAt` | ❌ | ✅ | String. Pure code point read. |
| `concat` | ❌ | ✅ | Array, String. Pure, answers a new value. |
| `constructor` | ❌ | ❌ | Object, Array, String, Number, Boolean, BigInt, Function. Data property, reaches `Function`. |
| `copyWithin` | ❌ | ❌ | Array. Mutates. |
| `endsWith` | ❌ | ✅ | String. Pure. |
| `entries` | ❌ | ❌ | Array. Answers an iterator, a type the language lacks. |
| `every` | ❌ | ✅ | Array. Pure, callback gets element, index, array. |
| `fill` | ❌ | ❌ | Array. Mutates. |
| `filter` | ❌ | ✅ | Array. Pure, answers a new array. |
| `find` | ❌ | ✅ | Array. Pure. |
| `findIndex` | ❌ | ✅ | Array. Pure. |
| `findLast` | ❌ | ✅ | Array. Pure. |
| `findLastIndex` | ❌ | ✅ | Array. Pure. |
| `fixed` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `flat` | ❌ | ✅ | Array. Pure, answers a new array. |
| `flatMap` | ❌ | ✅ | Array. Pure, answers a new array. |
| `fontcolor` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `fontsize` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `forEach` | ❌ | ❌ | Array. Answers `undefined`, exists for side effects. |
| `hasOwnProperty` | ❌ | ❌ | Object. Reflection, superseded by the planned `entry` pattern. |
| `includes` | ❌ | ✅ | Array, String. Pure, SameValueZero so `NaN` is found. |
| `indexOf` | ❌ | ✅ | Array, String. Pure, strict equality so `NaN` is not found. |
| `isPrototypeOf` | ❌ | ❌ | Object. Prototype reflection. |
| `isWellFormed` | ❌ | ✅ | String. Pure surrogate check. |
| `italics` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `join` | ❌ | ✅ | Array. Pure, elements converted to string. |
| `keys` | ❌ | ❌ | Array. Answers an iterator. |
| `lastIndexOf` | ❌ | ✅ | Array, String. Pure, strict equality. |
| `length` | ✅ | ✅ | Array, String, Function. Data property each value owns, so the read agrees with JavaScript. On neither list: a call of it is a call of what the value holds, a function on an object, a `TypeError` on an array, a string or a function. |
| `link` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `localeCompare` | ❌ | ❌ | String. Reads the host locale. |
| `map` | ❌ | ✅ | Array. Pure, answers a new array. |
| `match` | ❌ | ❌ | String. Coerces its argument to a `RegExp`. |
| `matchAll` | ❌ | ❌ | String. Coerces its argument to a `RegExp`. |
| `name` | ❌ | ❌ | Function. Data property, unobservable by the spec. |
| `normalize` | ❌ | ❌ | String. Depends on the engine's Unicode version. |
| `padEnd` | ❌ | ✅ | String. Pure. |
| `padStart` | ❌ | ✅ | String. Pure. |
| `pop` | ❌ | ❌ | Array. Mutates. |
| `propertyIsEnumerable` | ❌ | ❌ | Object. Reflection. |
| `push` | ❌ | ❌ | Array. Mutates. |
| `reduce` | ❌ | ✅ | Array. Pure, throws on an empty array with no initial value as JavaScript does. |
| `reduceRight` | ❌ | ✅ | Array. Pure, same. |
| `repeat` | ❌ | ✅ | String. Pure, `RangeError` on a bad count as JavaScript does. |
| `replace` | ❌ | ✅ | String. Pure with a string pattern, the only pattern this language can spell. |
| `replaceAll` | ❌ | ✅ | String. Same. |
| `reverse` | ❌ | ❌ | Array. Mutates. `toReversed` is the pure form. |
| `search` | ❌ | ❌ | String. Coerces its argument to a `RegExp`. |
| `shift` | ❌ | ❌ | Array. Mutates. |
| `slice` | ❌ | ✅ | Array, String. Pure. |
| `small` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `some` | ❌ | ✅ | Array. Pure. |
| `sort` | ❌ | ❌ | Array. Mutates. `toSorted` is the pure form. |
| `splice` | ❌ | ❌ | Array. Mutates. `toSpliced` is the pure form. |
| `split` | ❌ | ✅ | String. Pure with a string separator, the only one this language can spell. |
| `startsWith` | ❌ | ✅ | String. Pure. |
| `strike` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `sub` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `substr` | ❌ | ❌ | String. Annex B. Deprecated alias of `substring` and `slice`. |
| `substring` | ❌ | ✅ | String. Pure. |
| `sup` | ❌ | ❌ | String. Annex B. Legacy HTML wrapper. |
| `toExponential` | ❌ | ✅ | Number. Specified exactly. |
| `toFixed` | ❌ | ✅ | Number. Specified exactly. |
| `toLocaleLowerCase` | ❌ | ❌ | String. Reads the host locale. |
| `toLocaleString` | ❌ | ❌ | Object, Array, Number, BigInt. Reads the host locale. |
| `toLocaleUpperCase` | ❌ | ❌ | String. Reads the host locale. |
| `toLowerCase` | ❌ | ❌ | String. Depends on the engine's Unicode version. |
| `toPrecision` | ❌ | ✅ | Number. Specified exactly. |
| `toReversed` | ❌ | ✅ | Array. Pure, answers a new array. |
| `toSorted` | ❌ | ✅ | Array. Pure, default order by string conversion. The order an inconsistent comparator gives is the engine's (`todo/to-sorted-inconsistent-comparator.md`). |
| `toSpliced` | ❌ | ✅ | Array. Pure, answers a new array. |
| `toString` | ❌ | ✅ | Object, Array, String, Number, Boolean, BigInt, Function. Pure on each type; on a function it answers the conversion's placeholder rather than its source, a stub until a function carries its EDAG (`nanvm-lib/todo/member-functions.md`). |
| `toUpperCase` | ❌ | ❌ | String. Depends on the engine's Unicode version. |
| `toWellFormed` | ❌ | ✅ | String. Pure. |
| `trim` | ❌ | ✅ | String. Pure. |
| `trimEnd` | ❌ | ✅ | String. Pure. |
| `trimLeft` | ❌ | ❌ | String. Annex B. Deprecated alias of `trimStart`. |
| `trimRight` | ❌ | ❌ | String. Annex B. Deprecated alias of `trimEnd`. |
| `trimStart` | ❌ | ✅ | String. Pure. |
| `unshift` | ❌ | ❌ | Array. Mutates. |
| `valueOf` | ❌ | ❌ | Object, String, Number, Boolean, BigInt. Coercion protocol, which the operators already spell. |
| `values` | ❌ | ❌ | Array. Answers an iterator. |
| `with` | ❌ | ✅ | Array. Pure, `RangeError` out of range as JavaScript does. |

| | names |
|---|---|
| all | 100 |
| read allowed | 1 |
| call allowed | 44, and `length` as an own property |
| call prohibited | 55 |
