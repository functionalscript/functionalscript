import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray
} from '../types/rtti/module.f.mjs'

const primitiveList = /** @type {const} */([
    boolean,
    number,
    null,
    undefined,
    string,
    bigint,
])

/**
 * @type {() => readonly['or',
 *  typeof boolean,
 *  typeof number,
 *  null,
 *  undefined,
 *  typeof string,
 *  typeof bigint,
 * ]}
 */
export const primitive = () => ['or', ...primitiveList]

/**
 * @type {() => readonly['or',
 *  typeof boolean,
 *  typeof number,
 *  null,
 *  undefined,
 *  typeof string,
 *  typeof bigint,
 *  typeof array,
 *  typeof object,
 *  typeof args,
 *  typeof propertyAccessor,
 * ]}
 */
export const exp = () => ['or',
    //
    ...primitiveList,
    array,
    object,
    //
    args,
    propertyAccessor,
]

const expArray = rttiArray(exp)

// types

const array = /** @type {const} */(['[]', expArray])

const property = /** @type {const} */([exp, exp])

const object = /** @type {const} */(['{}', rttiArray(property)])

// operators

const args = /** @type {const} */(['args'])

const propertyAccessor = /** @type {const} */(['.', exp, exp])

const own = /** @type {const} */(['own', exp, exp])

const comma = /** @type {const} */([',', expArray])
