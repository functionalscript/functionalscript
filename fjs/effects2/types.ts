import type { Assert } from "../asserts/types.ts"
import type { Result, ResultInfo } from "../types/result/types.ts"
import type { Equal } from "../types/ts/types.ts"

export type Operation = {
    readonly name: string,
    readonly func: (...args: readonly never[]) => Result<unknown, unknown>
}

export type Effect<O extends Operation, T, E = unknown> = Pure<T, E> | Do<O, T, E>

export type Pure<T, E> =
    () => Result<T, E>

export type Do<out O extends Operation, T, E> = {
    readonly name: O['name']
    readonly payload: OperationInfo<O>['args']
    readonly continuation: Cont<O, T, E>
}

export type OperationInfo<O extends Operation> =
    O extends {
        readonly name: O['name'],
        readonly func: (...args: infer P) => infer R
    }
    ? {
        readonly args: P
        readonly result: R
    }
    : never

export type Cont<out O extends Operation, T, E> =
    (_: OperationInfo<O>['result']) => Effect<O, T, E>

export type CommandSet<O extends Operation> =
    Readonly<Record<O['name'], null>>

export type Commands<O extends Operation> =
    readonly O['name'][]

export type Func<O extends Operation> =
    (..._: Args<O>) => Effect<O, ResultInfo<Return<O>>['ok'], ResultInfo<Return<O>>['error']>

export type Args<O extends Operation> = OperationInfo<O>['args']

export type Return<O extends Operation> = OperationInfo<O>['result']

type TestOp = {
    readonly name: 'hello',
    readonly func: () => Result<number, string>
}

type _0 = Assert<Equal<ResultInfo<Return<TestOp>>['ok'], number>>
