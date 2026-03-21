import type { Unknown } from '../../../djs/module.f.ts'
import { isTag1, type Const, type ConstObject, type Info0, type Info1, type Primitive0, type Struct, type Tag0, type Tag1, type Thunk, type Tuple, type Type } from '../module.f.ts'
import { error, ok, type Result as CommonResult } from '../../result/module.f.ts'
import type { Ts } from '../ts/module.f.ts'
import { isArray as commonIsArray } from '../../array/module.f.ts'
import { isObject as commonIsObject, type ReadonlyRecord } from '../../object/module.f.ts'
import { identity } from '../../function/module.f.ts'
import type { Primitive } from '../../../djs/module.f.ts'

export type Result<T extends Type> = CommonResult<Ts<T>, string>

export type Validate<T extends Type> = (value: Unknown) => Result<T>

type IsContainer<C extends Unknown> = (value: Unknown) => value is C

type GetItems<C extends Unknown> = (value: C) => ReadonlyArray<Unknown>

type Container<K extends Tag1> = K extends 'array'
    ? ReadonlyArray<Unknown>
    : ReadonlyRecord<string, Unknown>

const containerValidate =
    <K extends Tag1>(isContainer: IsContainer<Container<K>>, getItems: GetItems<Container<K>>) =>
    <I extends Type>(item: I): Validate<Info1<K, I>> => value =>
{
    if (!isContainer(value)) {
        return error('unexpected value') as any
    }
    const items = getItems(value)
    if (items.length === 0) {
        return ok(value)
    }
    // Note: we shouldn't instantiate `item` RTTI until we get a value.
    //       Otherwise, we can get infinte recursion on empty arrays
    const itemValidate = validate(item)
    for (const i of items) {
        const r = itemValidate(i)
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const isArray: IsContainer<ReadonlyArray<Unknown>> =
    value => commonIsArray(value)

const arrayValidate = containerValidate<'array'>(isArray, identity)

const isObject: IsContainer<ReadonlyRecord<string, Unknown>> =
    value => commonIsObject(value)

const recordValidate = containerValidate<'record'>(isObject, Object.values)

const tag1Validate = <K extends Tag1, I extends Type, T extends Info1<K, I>>([tag, item]: T): Validate<T> =>
    tag === 'array'
        ? arrayValidate(item) as any
        : recordValidate(item) as any

const primitive0Validate = <K extends Primitive0, T extends Info0<K>>(tag: K): Validate<T> =>
    value => typeof value === tag ? ok(value) as any : error('unexpected value') as any

const thunkValidate = <T extends Thunk>(rtti: T): Validate<T> => {
    const info = rtti()
    const [tag, value] = info
    switch (tag) {
        case 'const':
            return constValidate(value) as any
        case 'unknown':
            return ok as any
    }
    return isTag1(tag)
        ? tag1Validate(info as Info1<typeof tag, typeof value>) as any
        : primitive0Validate(tag) as any
}

const constContainerValidate =
    <C extends Unknown>(isContainer: IsContainer<C>, getItem: (value: C, k: string) => Unknown) =>
    <T extends Tuple|Struct>(rtti: T): Validate<T> => value =>
{
    if (!isContainer(value)) {
        return error('unexpectd value') as any
    }
    for (const [k, v] of Object.entries(rtti)) {
        const item = getItem(value, k)
        const r = (validate(v) as any)(item) as Result<T>
        if (r[0] === 'error') {
            return r
        }
    }
    return ok(value)
}

const tupleValidate = constContainerValidate<ReadonlyArray<Unknown>>(
    isArray,
    (value, k) => value[Number(k)]
)

const structValidate = constContainerValidate<ReadonlyRecord<string, Unknown>>(
    isObject,
    (value, k) => value[k]
)

const constObjectValidate = <T extends ConstObject>(rtti: T): Validate<T> =>
    commonIsArray(rtti)
        ? tupleValidate(rtti) as any
        : structValidate(rtti) as any

const constPrimitiveValidate = <T extends Primitive>(rtti: T): Validate<T> =>
    value => rtti === value
        ? ok(value) as any
        : error('unexpected value') as any

const constValidate = <T extends Const>(rtti: T): Validate<T> =>
    typeof rtti === 'object' && rtti !== null
        ? constObjectValidate(rtti) as any
        : constPrimitiveValidate(rtti) as any

export const validate = <T extends Type>(rtti: T): Validate<T> =>
    typeof rtti === 'function'
        ? thunkValidate(rtti) as any
        : constValidate(rtti) as any
