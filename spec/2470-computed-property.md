# Computed Property

A property key may be written as a string literal in brackets.

```js
export default {
    ["a"]: "hello",
}
```

The brackets hold a string literal, not an expression: a computed key is a
constant, like the other two spellings. `{ ["a"]: 1 }`, `{ "a": 1 }`
([JSON](./1000-json.md)), and `{ a: 1 }`
([identifier-property](./2410-identifier-property.md)) all denote the same
object.

The three spellings mix freely inside one object:

```js
export default { a: 1, "b": 2, ["c"]: 3 }
```

For one key the computed form is not an alternative but the only spelling:
`__proto__` ([proto-property-key](./2480-proto-property-key.md)).

A key computed from anything else — a reference, or any other expression — is
not recognized yet; see the [roadmap](./todo/README.md).

Depends on [default-export](./2110-default-export.md).
