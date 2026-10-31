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

`transduce(machine)(emit)(source)` runs the shared
[`Transducer`](../../types/function/operator/types.ts) lifecycle over an effect
list. Each nonempty output chunk is passed to the effectful `emit` callback
before the next input is pulled. The final flush reaches the sink before the
effect returns the terminal summary. `run(machine)(source)` returns the summary
while discarding output.

The machine's initial step runs before any source pull. Initial or later
completion stops reading immediately, including on an unbounded source, and
does not call `end` again. Source and sink failures propagate through the
effect's error channel; a domain failure carried by the machine remains its
summary value. A failing source does not trigger EOF finalization, and a failing
flush prevents a successful summary.

Output is delivered directly to the sink instead of collecting a second list.
This matters for the effect representation: pure cells are strict, while real
commands suspend. The driver loops through pure spans without growing the call
stack and leaves source and sink commands suspended for their runner.

**A failure ends the stream.** The error belongs to the cell, not to an item,
so a producer that cannot deliver fails the effect that would have produced the
next cell, and `step` propagates it to the consumer without a check per item.

Node's `readChunks` answers an `EffectList` of byte chunks, read as the
consumer pulls them ([`node`](../node/README.md)).
