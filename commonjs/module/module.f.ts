import type * as O from '../../types/object/module.f.ts'

export type MapInterface<M> = {
    readonly at: (moduleId: string) => (moduleMap: M) => State | null
    readonly setReplace: (moduleId: string) => (moduleState: State) => (moduleMap: M) => M
}

export type State =
    | readonly['ok', Module]
    | readonly['error', Error]

type Module = {
    readonly exports: unknown
    readonly requireMap: O.Map<string>
}

export type Error =
    | ['file not found']
    | ['compilation error', unknown]
    | ['runtime error', unknown]
    | ['circular reference']

export type Id = {
    readonly package: string
    readonly path: readonly string[]
}

export const dir = (id: Id): Id | null => {
    const len = id.path.length
    if (len < 1) { return null }
    return {
        package: id.package,
        path: id.path.slice(0, len - 1)
    }
}

export const idToString = (id: Id): string =>
    `${id.package}/${id.path.join('/')}`
