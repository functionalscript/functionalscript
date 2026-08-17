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
the two disagree about it. The extension of each file **named on the command
line** picks its language:

```sh
fjs compile input.f.js output.f.js   # {["__proto__"]:1}
fjs compile input.f.js output.json   # {"__proto__":1}
fjs compile input.json output.f.js   # reads {"__proto__":1} as a property
```

So a JSON document survives the loop `proto.json → a.f.js → out.json` byte for
byte, each hop spelling the key its own language's way. The identifier
spelling is not a key in either language: no JSON document contains one, so
`{__proto__: 1}` is an error whatever the input file is called.

An imported file is read as a FunctionalScript module however it is named, and
a JSON document is not a module ([JSON](./1000-json.md)), so a JSON file
cannot be imported at all yet. What would declare an import's language is the
import statement, `with { type: "json" }`, which the language does not have
([import-attributes](./todo/2140-import-attributes.md)).

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

## The one key the two languages read differently

`"__proto__"` is an ordinary data key in a JSON document — `JSON.parse` makes
it an own property — and a prototype assignment in a JavaScript module. It is
the only text the two languages disagree about; every other JSON document
denotes the same value in both.

Each language keeps its own reading, because each is right about itself:
JSON's reader gives the document the value `JSON.parse` gives it, and the
module parser refuses the spelling rather than give a module a value no
JavaScript engine would give it, which would break principle 2.

The disagreement is about a *text*, not a value, so nothing is unreachable: a
document carrying the key compiles, into a module spelling that same key the
JavaScript way ([JSON](./1000-json.md)).

Depends on [computed-property](./2470-computed-property.md).
