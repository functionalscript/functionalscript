import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray,
} from "../types/rtti/module.f.mjs";

export const exp = () => /** @type {const} */(['or', primitive])

export const primitive = or(undefined, null, boolean, number, string, bigint)

export const array = /** @type {const} */(['[]', rttiArray(exp)])
