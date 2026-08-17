# Identifier Property

```js
export default {
    a: "hello",
}
```

`__proto__` is the one identifier this form does not accept: it assigns a
prototype in JavaScript instead of adding a property, and only the computed
spelling denotes a key
([proto-property-key](./2480-proto-property-key.md)).

Depends on [default-export](./2110-default-export.md).
