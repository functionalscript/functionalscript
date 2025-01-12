export type DjsModule = [readonly string[], readonly DjsConst[]]

export type DjsConst = boolean|string|number|null|bigint|undefined|DjsModuleRef|DjsArray|DjsObject

export type DjsModuleRef = ['aref' | 'cref', number]

export type DjsArray = ['array', readonly DjsConst[]]

export type DjsObject = {
    readonly [k in string]: DjsConst
}