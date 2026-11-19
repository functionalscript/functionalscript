// The empty reference map of `fjs/types/ref_map`, compiled as the EDAG's
// `['refMap']` and run on NaNVM by the runtime's map: a read answers the
// key's value and the same map, a set the value the key had and a new map,
// keys are references, and a primitive is never one. Node runs the
// recognized body itself, so the two agree where it and the runtime's do.
import { empty } from '../../../fjs/types/ref_map/module.f.js';

/** A primitive where a key is expected. @type {(value: unknown) => object} */
const asKey = value => /** @type {object} */ (value);
const a = { x: 1 };
const alike = { x: 1 };
const list = [1];
const f = () => 1;
const [none, same] = empty(a);
const [previous, one] = empty(a, "a");
const [, two] = one(list, "list");
const [, three] = two(f, "f");
const [old, four] = three(a, "again");
const other = empty(a, "other")[1];
export default [
    none,
    same === empty,
    previous,
    one === empty,
    one(a)[0],
    one(a)[1] === one,
    one(alike)[0],
    three(list)[0],
    three([1])[0],
    three(f)[0],
    three(a)[0],
    old,
    four(a)[0],
    three(a, undefined)[1] === three,
    four(asKey(1))[0],
    four(asKey("k"))[0],
    four(asKey(null))[0],
    other(a)[0],
    empty(a)[0],
    typeof four,
    four.length,
    empty.length,
    four(four, 1)[1](four)[0],
];
