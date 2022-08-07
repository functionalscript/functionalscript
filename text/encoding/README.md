# UNICODE

## UTF-8

Requirement: no loss for UTF8 => codepoint => UTF8

|utf8     |codepoint|
|---------|---------|
|[a]      |+        |
|[a,b]    |+        |
|[a,b,c]  |+        |
|[a,b,c,d]|+        |
|[e]      |-        |
|[a,e]    |-        |
|[a,b,e]  |-        |
|[a,b,c,e]|-        |
|[a,]     |-        |
|[a,b,]   |-        |
|[a,b,c,] |-        |

## UTF-16

Requirement: no loss for UTF16 => codepoint => UTF16

|utf16    |codepoint|
|---------|---------|
|[a]      |+        |
|[a,b]    |+        |
|[e]      |-        |
|[a,e]    |-        |
|[a,]     |-        |

- UTF8 => codepoint => UTF16 => codepoint => UTF8 ?
- UTF16 => codepoint => UTF8 => codepoint => UTF16 ?

```js
/** @typedef {number} u8 */
/** @typedef {number} i8 */
/** @typedef {number} u16 */
/** @typedef {number} i16 */
/** @typedef {number} i32 */
```
