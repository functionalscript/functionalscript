# Modular Runtime

Here go loosely structured notes on how FJS compiler backend could be integrated with pluggable runtime modules, yielding a flexible experimentation platform.

Initially we target WASM code generation in addition to the currently existing Rust code generation. When the new system is mature enough, we will move Rust code generation to it. Later we will add more code generation target platforms (e.g. C++, Zig, LLVM IR, Binaryen IR).

In this memo we sketch use cases to figure out the future system design.

## Why modular?

When possible we want to make decisions of how to implement this or that feature set for a given runtime independent from each other (orthogonal). Besides, on some occasions it could be possible to provide a unified implementation of a feature set that serves several target platforms. Experimenting with feature combinations we will be able to figure out per-target packages that work best for this or that kind of applications (while compiling for  a given target).

In accordance with that strategy we plan for contract flexibility between FJS's code generation component and pluggable runtime modules. Thus each module specifies supported target platforms plus (maybe) compatibilities with other runtime modules. How exactly we should organize these specifications, we will figure out after considering use cases listed below.

## Two VMs: 'any'

The first FunctionalScript VM is a "Naive" Rust implementation where 'any' is a fat discriminated data structure. We have based the first WASM runtime on that implementation with plans to implement better alternatives.

In an upcoming alternative implementation we use NaN variations of f64 to represent 'any' values other than proper non-NaN f64 values, see doc/sergey-shandar/nanvm/README.md.

The new code generator communicates with both alternative runtimes through a unified API that abstracts out differences, allowing both runtimes to function as intended in resulting WASM executables. That includes different aspects of lifetime management of unpacked, cast-down typed values. Two most interesting cases (somewhat similar to each other) are String and BigInt values (considered in sections below).

The Naive VM represents each 'any' value as a refcounted pointer to a fat internal representation struct stored aside (in a heap memory). Thus copying an 'any' value always involves a refcount increment. Dropping an 'any' value always involves a refcount decrement followed up with a zero refcount check: in that case the aside internal representation struct gets disposed. Unpacking Naive 'any' for String, BigInt variants always uncovers internal refcounted representations which again involves refcount increments on unpacking and refcount decrements on dropping unpacked values.

The future NaN VM implementation stores certain kinds of values directly in NaN bits of the f64, allowing for cheaper copy operations for those (via simple copying of the given f64, no refcounting for aside memory blocks involved). In accordance, dropping such values is a no-op. Unpacking of such in-NaN values does not involve refctount increments, and, correspondingly, dropping does not involve refcount decrements.

Below, we consider 3 variations of how 3 different runtime modules implement String access of an 'any' value that carries a string. SIde note: BigInt access is somewhat similar but simpler, and we don't consider it here.

## Naive, NaN CPU-saving, and NaN memory-saving String runtime modules

Besides existing Naive VM logic of a String runtime module we are up to experimenting with at least two different NaN VM implementations, comparing their impact on the speed and memory footprint in test scenarios. Here we name one approach "memory-saving" since it does not require extra memory to store unpacked values -- while presumably being more computationally expensive (slower). We name the other approach "CPU-saving" since it yields simpler CPU logic for the price of using aside memory (more stack frame slots), presumably yielding faster code. Side note: it might happen that experimentation on real codebases leads to reasonable combinations where memory-saving approach is used for strings while CPU-saving approach is used for bigints, or vice versa.

Overall we plan to experiment on 3 variations of behavior for short strings, all hidden under the following unified interface to String values in runtime that consists of 3 functions:

- The initializing 'unpack' operation that logically "creates" a String value out of an 'any' value that represents a short string. It takes the stack frame offset of the 'any' value as the first parameter and, as the second and the last parameter, the stack frame offset of the space designated by the code generator for the unpacked string. In its static manifest, the current runtime module claims how many stack frame slots it needs for the unpacked value, maximum. The code generation components designates requested stack frame slots and passes the starting offset as the second the last parameter to 'unpack'. Each of the remaining 2 functions take that stack frame offset of the unpacked value slots as the first parameter as well. By a convention, in case the String runtime module does not do any actual unpacking, the unpacked value offset points to the originating 'any' value slot.
- The 'length accessor; the unpacked value stack frame offset is the one and only parameter.
- The 'at' indexer that takes a parameter within 0...(length-1) range to get a corresponding UTF16 character value; the unpacked value stack frame offset is the first parameter and the index value is the second parameter. The code generator ensures that the case of index-out-of-range situations in 'at' calls are handled in a safe manner.

Logically, the code generator tracks the lifetime of the unpacked string till the last access, after which it would issue a 'drop' call (with 'drop' being the fourth function of a String runtime module). However in the current design presented here, such 'drop' is a no-op call in each of 3 implementation so we don't introduce this function for the sake of simplicity.

Besides the stack frame slots requirement, a String runtime module specifies 3 references to the above mentioned functions it its manifest. As we see below, on occasions a String runtime module can specify a null reference for this or that function designating the fact that the corresponding function is a no-op.

By a convention, when a String runtime module that specifies zero stack frame slots for the unpacked value, the code generator provides the originating 'any' value offset for 'length' and 'at' calls. In any case, the code generator keeps the originating 'any' slot designated till the last access moment, after which that slot can be reused similarly to unpacked value slots (if any).

The Naive VM string module claims one stack frame slot of a size of a heap pointer (a 32-bit or a 64-bit value). 'Unpack' extracts a string heap pointer from 'any' struct into that slot. 'Length' and 'at' access the aside string struct referred by that pointer.

The CPU-saving NaN VM string module claims one byte stack frame for the short string length value (in 0..8 range with 0 being a special value corresponding the the long string case), followed by 8 16-bit character value slots for an unpacked short string (since according to doc/sergey-shandar/nanvm/README.md a NaN VM value can carry 8 6-bit character codes of a short string). When that length value is 0, the next stack frame slot keeps a long string pointer that is handled in same way as in Naive VM string module. In case of a short string, 'unpack' places the decoded short string length (in 1..8 range) and then extracts short string character codes in correspondent stack frame slots. 'Length' amd 'at' check the short string length value, doing the long string data access in case when that value is zero. In the case of non-zero short string length value, 'length' returns that value, and 'at' access the stack frame slot corresponding to the given index in one of 8 16-bit stack frame slots following the length value stack frame slot.

The memory-saving NaN VM string module specifies zero stack frame slots requirement for the unpacked string value, thus claiming, by a convention, that it needs the originating 'any' value stack frame access for 'length' and 'at' (which perform decoding of NaN 'any' value each time). Since there is no actual unpacking, 'unpack' function reference is null in the manifest.