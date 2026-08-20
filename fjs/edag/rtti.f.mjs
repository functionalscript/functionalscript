import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray,
} from "../types/rtti/module.f.mjs";

export const exp = () => /** @type {const} */(['or',
    primitive,
    array,
    object,
    args,
    // propertyAccessor,
])

export const primitive = or(undefined, null, boolean, number, string, bigint)

export const array = /** @type {const} */(['[]', rttiArray(exp)])

export const property = /** @type {const} */([exp, exp])

export const object = /** @type {const} */(['{}', rttiArray(property)])

export const args = /** @type {const} */(['args'])

export const propertyAccessor = /** @type {const} */(['.', exp, exp])
