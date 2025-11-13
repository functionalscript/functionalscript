# Functional Python 

|JS     |Python|
|-------|------|
|bigint |int   |
|number |float |
|boolean|bool  |
|null   |None  |
|array  |tuple |
|object |dict  |

## Problems

1. JS `string` is an immutable array of UTF16 characters, Python is a UNICODE sequence (most likely UTF-8 internally).
2. `undefined` has no direct mapping in Python.

## Conclusion

The languages are quite different. It would be better to develop Functional/CA Python separately without limitations from JavaScript. 
After that, we can design how we can interop these VMs.
