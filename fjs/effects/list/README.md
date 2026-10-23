# Effect lists

`EffectList<O, T, E>` is a stream: a list whose next cell is produced by an
effect, so reading it may perform operations, such as reading the next chunk of
a file. [`module.f.mjs`](./module.f.mjs) builds one, and
[`types.ts`](./types.ts) holds the types.

|Function             |Builds                                                       |
|---------------------|-------------------------------------------------------------|
|`empty()`            |the end of the stream                                        |
|`nonEmpty(first, tail)`|a cell                                                     |
|`fromList(list)`     |a stream over a plain [`List`](../../types/list/types.ts)   |

**A failure ends the stream.** The error belongs to the cell, not to an item,
so a producer that cannot deliver fails the effect that would have produced the
next cell, and `step` propagates it to the consumer without a check per item.

Node's `readChunks` answers an `EffectList` of byte chunks, read as the
consumer pulls them ([`node`](../node/README.md)).
