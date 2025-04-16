# Call-like instructions

Call-like bytecode instruction include following groups:

- calls into user-defined functions ("proper calls");
- calls into host functions - standard language runtime "intrinsics" (including operators);
- other call-like instructions - mentioned here thanks to similarities to above mentioned groups.

## 1. Calls into host functions

Each host function has a stable identification (e.g. a numeric id predefined within a given FS
release) and runtime metadata specifying among other things its number of parameters and whether or
not it returns a result.

The interpreter accesses metadata upon decoding the starting part of a call instruction. Knowing the
number of parameters and result presence flag, it continues decoding argument instructions filling
out an internal data structure best fit for the given host function. For example,

```js
const c = a + b
```

produces bytecode for calling host's implementation of operator plus, followed by slot
specifications for a, b and c at the caller stack frame. This allows to execute that built-in
function without overhead of copying a, b to the top of the stack and then copying the result
to the caller stack frame slot allocated for c.

## 2. Static calls into user-defined functions

In case when bytecode generator has complete information of a function being called, . . .

