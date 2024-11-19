# Byte Code

This format is designed for fast and straightforward serialization and doesn't depend on a particular VM implementation.

**Requirements:** 
- VM serializer/deserializer should be very simple.
    - string: UTF16
    - number: in a binary format
    - bigint: in a binary format
    - len: u32
- the byte code doesn't know anything about importing modules or I/O functions.
- the byte code shouldn't contain syntax sugar.
- serialized in a byte array so we can save it into a file. One byte is one unit.
- least-significant byte first.

```rust
struct Array<T> {
    len: u32,
    array: [T; self.len],
}
 
type String = Array<u16>;

// LSB first.
type BigUInt = Array<u64>;

type Object = Array<(String, Any)>;

// This is the main structure for serialization.
type Code = Array<u8>;

struct Function {
    length: u32
    code: Code
}

// This structure is not for serialization because
// a serialized module should resolve all imports.
struct Module {
    import: Array<String>
    code: Code
}
```

|format|any            |Tag|                       |
|------|---------------|---|-----------------------|
|JSON  |null           | 00|                       |
|      |number         | 01|u64                    |
|      |false          | 02|                       |
|      |true           | 03|                       |
|      |string         | 04|String                 |
|      |object         | 05|Object                 |
|      |array          | 06|Array<Any>             |
|DJS   |ref            | 07|u32                    |
|      |positive_bigint| 08|BigUInt                |
|      |negative_bigint| 09|BigUInt                |
|FJS   |function       | 0A|Function               |
|      |arg_ref        | 0B|u32                    |
