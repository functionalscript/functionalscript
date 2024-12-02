# Built-in Objects and Functions

The built-in objects are special. We can get a function, like `Object.getOwnPropertyDescriptor`, but not the `Object` itself.

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Some of the JS built-in objects and functions are "not allowed" in FS. It means, an FS compiler rejects code that contains "not allowed" objects and functions. 

## Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

Functions:

|Function                 |Priority   |
|-------------------------|-----------|
|constructor              |not allowed|
|assign                   |not allowed|
|create                   |not allowed|
|defineProperties         |not allowed|
|defineProperty           |not allowed|
|entries                  |1          |
|freeze                   |not allowed|
|fromEntries              |1          |
|getOwnPropertyDescriptor |1          |
|getOwnPropertyDescriptors|1          |
|getOwnPropertyNames      |1          |
|getOwnPropertySymbols    |not allowed|
|getPrototypeOf           |not allowed|
|groupBy                  |1          |
|hasOwn                   |1          |
|is                       |1          |
|isExtensible             |not allowed|
|isFrozen                 |not allowed|
|isSealed                 |not allowed|
|keys                     |1          |
|preventExtensions        |not allowed|
|seal                     |not allowed|
|setPrototypeOf           |not allowed|
|values                   |1          |

## Array

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

|Function                 |Priority   |
|-------------------------|-----------|
|from                     |1          |
|fromAsync                |1          |
|isArray                  |1          |
|of                       |1          |

## BigInt

|Function                 |Priority   |
|-------------------------|-----------|
|asIntN                   |1          |
|asUintN                  |1          |

## JSON

|Function                 |Priority   |
|-------------------------|-----------|
|`isRawJSON`              |3          |
|`parse`                  |2          |
|`rawJSON`                |3          |
|`stringify`              |2          |

## Others

`Infinity`
`isFinite()`
`isNaN()`
`NaN`
