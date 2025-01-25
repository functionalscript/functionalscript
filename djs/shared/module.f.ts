export type AstModule = [readonly string[], AstBody]

export type AstConst = boolean|string|number|null|bigint|undefined|AstModuleRef|AstArray|AstObject

export type AstModuleRef = ['aref' | 'cref', number]

export type AstArray = ['array', readonly AstConst[]]

export type AstObject = {
    readonly [k in string]: AstConst
}

export type AstBody = readonly AstConst[]