import { add as sum, absent } from "./named-imports-math.mjs";
import d, { a as first, z as second, default as again } from "./named.mjs";
import { a as repeated } from "./named.mjs";
import {} from "./named-imports-math.mjs";

export const main = () => sum(20, 22);
export const captured = () => () => first;
export const checks = [d === first, first === second, d === again, first === repeated, captured()() === first, absent === undefined];
