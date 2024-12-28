# Built-in Objects and Functions

The built-in objects are special. We can call a function, like `Object.getOwnPropertyDescriptor()`, but not the `Object` or the function.

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

Some of the JS built-in objects and functions are "not allowed" in FS. It means, an FS compiler rejects code that contains "not allowed" objects and functions.

## Object

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object

|Function                 |side-effect                |
|-------------------------|---------------------------|
|assign                   |mutate                     |
|create                   |creates a special prototype|
|defineProperties         |mutate                     |
|defineProperty           |mutate                     |
|entries                  |no                         |
|freeze                   |mutate                     |
|fromEntries              |no                         |
|getOwnPropertyDescriptor |no                         |
|getOwnPropertyDescriptors|no                         |
|getOwnPropertyNames      |no                         |
|getOwnPropertySymbols    |return symbols             |
|getPrototypeOf           |return prototypes          |
|groupBy                  |return null-property object|
|hasOwn                   |no                         |
|is                       |no                         |
|isExtensible             |no                         |
|isFrozen                 |no                         |
|isSealed                 |no                         |
|keys                     |no                         |
|preventExtensions        |mutate                     |
|seal                     |mutate                     |
|setPrototypeOf           |mutate                     |
|values                   |no                         |

## Array

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

|Function                 |side-effect|
|-------------------------|-----------|
|from                     |no         |
|fromAsync                |?          |
|isArray                  |no         |
|of                       |no         |

## BigInt

|Function                 |side-effect|
|-------------------------|-----------|
|asIntN                   |no         |
|asUintN                  |no         |

## JSON

|Function                 |side-effects|
|-------------------------|-----------|
|`isRawJSON`              |no         |
|`parse`                  |no         |
|`rawJSON`                |no         |
|`stringify`              |no         |

## Others

|Function                 |side-effect|
|-------------------------|-----------|
|`decodeURI()`            |no         |
|`decodeURIComponent()`   |no         |
|`encodeURI()`            |no         |
|`encodeURIComponent()`   |no         |
|`eval()`                 |no         |

|Property    |side-effect|
|------------|-----------|
|`Infinity`  |no         |
|`isFinite()`|no         |
|`isNaN()`   |no         |
|`NaN`       |no         |
