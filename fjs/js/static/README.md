# Static functions

The static functions of the built-ins that a FunctionalScript module may call,
each as a path of keys: `['Object', 'is']` is `Object.is`.
[`module.f.js`](./module.f.js) holds the list; [`prototype`](../prototype/README.md)
holds the member functions beside it.

|Export                |Holds                                                                                                                            |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------|
|`statics`             |every admitted path: `Object.is`, `Object.entries`, `Object.fromEntries`, `Number.isInteger`, `Number.isSafeInteger`, `Number.isNaN`, `Number.isFinite`, `String.fromCharCode`|
|`natives`             |the paths no function body can define, which every executor binds natively: `Object.entries`, `String.fromCharCode`                                     |
|`isStatic`, `isNative`|the tests for a path                                                                                                             |

Every static in `statics` but the natives has its body in
[`runtime`](../runtime/README.md), written in FunctionalScript. `Object.entries`
is native because enumerating an object's keys is something the language has
no other way to do.

The four `Number` predicates are admitted because none of them converts its
argument; the global `isNaN` and `isFinite`, which do, are not
([`spec/todo/2360-built-in.md`](../../../spec/todo/2360-built-in.md)).

`String.fromCharCode` converts all arguments to UTF-16 code units in order,
including lone surrogates. It reads no `this`: destructured calls work and its
`length` is 1, as in JavaScript. Other `String` statics remain prohibited.
