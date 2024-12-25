export type Ok<T> = readonly ['ok', T]

export type Error<E> = readonly ['error', E]

export type Result<T, E> = Ok<T> | Error<E>

export const ok
    : <T>(value: T) => Ok<T>
    = value => ['ok', value]

export const error
    : <E>(e: E) => Error<E>
    = e => ['error', e]

export const unwrap
    : <T, E>(r: Result<T, E>) => T
    = ([kind, v]) => {
        if (kind === 'error') { throw v }
        return v
    }
