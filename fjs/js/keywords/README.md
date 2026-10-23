# Keywords

The words JavaScript reserves, as lists, and `isKeyword`.
[`module.f.js`](./module.f.js) is the one place they are written, so the
tokenizer, the parser, the serializer and the RTTI TypeScript printer agree on
which words are not identifiers.

|Export                   |Holds                                                                                                                |
|-------------------------|---------------------------------------------------------------------------------------------------------------------|
|`reservedWords`          |the words that are never identifiers: `await`, `break`, `class`, `const`, `enum`, …                                  |
|`strictModeReservedWords`|the words reserved in strict mode, which every module is: `let`, `static`, `implements`, …                           |
|`restrictedNames`        |`arguments` and `eval`, which strict mode forbids binding                                                            |
|`literalWords`           |the words that spell a value: `true`, `false`, `null`, `undefined`, `NaN`, `Infinity`                                |
|`literalGlobals`         |the three of those that are globals rather than keywords: `undefined`, `NaN`, `Infinity`                             |
|`reservedGlobals`        |`Array`, `Number`, `Object` and `String`: not keywords, but names a module may not bind or shadow                    |
|`keywords`, `isKeyword`  |the reserved words, the strict-mode words, the restricted names and the literal globals, sorted, and the test for one|
|`isReservedGlobal`       |the test for a reserved global; never true for a keyword                                                             |

```js
import { isKeyword } from './module.f.js'

isKeyword('const') // true
isKeyword('foo')   // false
```

A FunctionalScript module runs as a strict-mode JavaScript module, so the
strict-mode words are reserved here even though a sloppy script could use
them.
