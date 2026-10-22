# Open containers

**Status:** implemented

`open(c)` is the counterpart: the members `c` declares, plus anything else.
`rest(c, r)` states the middle ground — those members, plus any number of
members belonging to `r`.

| schema | admits |
| --- | --- |
| `[number]` | arrays of exactly one number |
| `open([number])` | any array whose position 0 is a number |
| `rest([number], string)` | one number, then any number of strings |
| `{ a: number }` | objects with `a` and no other key |
| `open({ a: number })` | any object whose `a` is a number |
| `rest({ a: number }, string)` | `a`, plus any number of string-valued keys |

Openness is what makes a reader forward-compatible: a schema that says `open`
keeps reading a serialization format that has grown fields. So a schema read
against a wire format someone else may extend says `open`, and one describing a
closed vocabulary — an ADT's nodes, a tool's arguments — does not. The protocol
and media modules say `open` with the reason written beside them; `edag` says
nothing, because its grammar claims each JS chain has exactly one spelling.

Three things follow from stating openness this way rather than inferring it.

**It needs no new concept underneath.** The data form's array and object sets
are both `{ members, rest? }` already, so `rest` is the schema-form spelling of
a `rest` that form has always carried: `never` is the bare, closed container,
`unknown` is openness, and a stated `rest` is itself. `rest(c, unknown)`
therefore normalizes to `open(c)` — the same `Node`, the same acceptance — and
`rest(c, never)` normalizes back to the bare `c`. A container whose undeclared
members must be the *value* `undefined` states that rest as a wrapped const,
`() => ['const', undefined]`.

**Both parameters of `rest` are required.** An optional one would need a
sentinel for "no undeclared member", and every candidate — `undefined` most of
all — is a `Type` in its own right, so the sentinel would collide with the
schema it spells. `never` carries no such ambiguity, and there is no overload.

**It widens acceptance, not construction.** `parse` builds the declared members
and nothing else, exactly as it does for the bare form; a member matching a
`rest` is checked on the way in and absent on the way out. `rest` says what an
undeclared member must be, not that the reader should keep it — the reader that
keeps every member is `validate`, which returns the value it was given here as
everywhere else.

**`Ts<>` renders the tail.** `RestTs` renders `rest(c, r)`'s tuple tail as
`...(Ts<r> | undefined)[]`: a hole past the prefix is no member, so a reader
skips it and the index reads `undefined`. An **empty** rest renders no tail —
`rest(c, or())` is the bare `c`, one set and so one rendering. What counts as
empty is `emptyRest`'s question in `fjs/rtti/data/module.f.mjs`, a `toData` conversion
compared with `subset` both ways, which `types.ts` cannot invoke; `RestTs`
recognizes the one directly spellable empty rest, `or()`, and keeps the tail
whenever it cannot tell. A kept tail is wider than the schema but sound, which
is the direction a success cast needs. The runtime printer goes through the data
form and recognizes the rest semantically, so the two differ on
`rest([42], [or()])` — the printer drops the tail there and `Ts<>` does not.

An **empty rest bounds an array's length**, which is the bare form's rule
arriving through the other spelling: `array(or())` is the empty array and not
"any number of holes", and `rest([42], or())` rejects `[42, , ]` exactly as
`[42]` does.

## Examples

The [RTTI demo](../../../README.md) shows `open` in its *Closed vs open* lesson and `rest` in its
*Tuple vs rest* lesson: `[1,"a","b"]` is refused by `[number, string]` and
accepted by `rest([number], string)`.

## Reference

- TypeScript: [index signatures](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures)
  and [rest elements in tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types)
- JSON Schema: `additionalProperties` and `items` holding the rest's schema
  ([object](https://json-schema.org/understanding-json-schema/reference/object),
  [array](https://json-schema.org/understanding-json-schema/reference/array))

## Where it is implemented

`rest` and `open` in [`module.f.mjs`](../../../module.f.mjs); `restContainerRead`
in [`common`](../../../common/module.f.mjs); `emptyRest` and the rest's
normalization in [`data`](../../../data/module.f.mjs); `RestTs` in
[`ts/types.ts`](../../../ts/types.ts).
