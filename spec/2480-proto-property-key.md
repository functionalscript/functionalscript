# `__proto__` Property Key

JavaScript gives the three spellings of a `__proto__` key two different
meanings:

```js
{ __proto__: v }      // sets [[Prototype]]; no own property
{ "__proto__": v }    // sets [[Prototype]]; no own property
{ ["__proto__"]: v }  // an ordinary own property named "__proto__"
```

Only the computed spelling ([computed-property](./2470-computed-property.md))
denotes a property.

## The rule

The identifier and string spellings are **not** valid FunctionalScript: they
are compilation errors.

```js
export default { __proto__: 1 }     // error
export default { "__proto__": 1 }   // error
export default { ["__proto__"]: 1 } // ok
```

FunctionalScript has no prototype chains at run time
([property-accessor](./todo/2330-property-accessor.md)), so a spelling whose
only meaning is "assign a prototype" has no meaning to give. Rejecting it is
the whitelist principle rather than a special case, and it keeps principle 2:
a module means on the FunctionalScript VM what it means on any other
JavaScript engine.

A value may still carry a `__proto__` property; what a module cannot do is
*read* it with `o.__proto__`, which is a separate rule of
[property-accessor](./todo/2330-property-accessor.md).

## Compilation

`fjs compile` reads and writes the key differently in each language, because
the two disagree about it. The file extension names the language on both
sides:

```sh
fjs compile input.f.js output.f.js   # {["__proto__"]:1}
fjs compile input.f.js output.json   # {"__proto__":1}
fjs compile input.json output.f.js   # reads {"__proto__":1} as a property
```

So a JSON document survives the loop `proto.json → a.f.js → out.json` byte for
byte, each hop spelling the key its own language's way. The identifier
spelling is not a key in either language: no JSON document contains one, so
`{__proto__: 1}` stays an error whatever the input file is called.

The extension is the declaration, not a guess about the content. JavaScript
decides the same way: `import` takes a module's type from the extension — or,
in a browser, the response MIME type — together with an import attribute
(`with { type: "json" }`), and never from the text. A `.js` file holding JSON
is JavaScript there, and stating `type: "json"` for it is an error rather than
a reinterpretation.

In JavaScript output the computed form is what makes the module round-trip:
it is the only spelling whose evaluation reproduces the property. In JSON
output the plain key stays — `JSON.parse` has no prototype special case, so
JSON already round-trips, and the computed form is not JSON at all.

## JSON is a subset of FunctionalScript except here

`"__proto__"` is an ordinary data key in a JSON document — `JSON.parse` makes
it an own property — so a JSON document containing that key is **not** a valid
FunctionalScript module. This is the one documented exception to
[JSON](./1000-json.md)'s subset claim; every other JSON document means the same
thing in both languages.

The alternative would be for FunctionalScript to accept the spelling and read
it as a data property, but then FunctionalScript source would mean something
different from what a JavaScript engine gives it, breaking principle 2. A
narrow, stated exception is the cheaper price.

The exception is about the *language a file is written in*, not about the
value: such a document is still readable, as JSON. `fjs compile` reads a
`.json` input as JSON and any other input as FunctionalScript, so the document
compiles — into a module spelling the same key the JavaScript way.

Depends on [computed-property](./2470-computed-property.md).
