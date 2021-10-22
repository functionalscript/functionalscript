const todo = () => { throw 'not implemented' }

/** @type {<F>(source: string, c: string, found: (before: string, after: string) => F, notFound: (c: string, source: string) => F) => F} */
const splitOne = (source, c, found, notFound) => {
    const i = source.indexOf(c)
    return i !== -1 ? found(source.substring(0, i), source.substring(i + 1)) : notFound(c, source)
}

/** @typedef {{org: string, name: string}} RepoId */
/** @typedef {{repo: RepoId}} ModuleRepoId */
/** @typedef {{repo: RepoId, branch: string}} ModuleRepoBranchId */
/** @typedef {{repo: RepoId, commit: string}} ModuleRepoCommitId */
/** @typedef {ModuleRepoId|ModuleRepoBranchId|ModuleRepoCommitId} ModuleId */

/** @typedef {(..._: string[]) => string} GetMsg */
/** @typedef {'expected'|'unknownProtocol'} ErrorId */
/** @typedef {{[_ in ErrorId]: GetMsg}} ErrorMap */
/** @typedef {{ id: ErrorId, params: string[]}} ErrorValue */

/** @typedef {{error: ErrorValue}} ErrorResult */

/**
 * @template T
 * @typedef {{value: T}} ValueResult
 */

/**
 * @template T 
 * @typedef {ErrorResult|ValueResult<T>} Result 
 */

/**
 * @type {<T>(v: T) => ValueResult<T>}
 */
const value = value => ({value})

/** @type {(id: ErrorId) => (...params: string[]) => ErrorResult} */
const error = id => (...params) => ({error: { id, params }})

/** @type {<T, R>(v: Result<T>, f: (_: T) => Result<R>) => Result<R>} */
const errorMap = (v, f) => 'error' in v ? v : f(v.value)

/** @type {(_: string) => Result<ModuleId>} */
const parseRepo = repo => {
    const s = repo.split('/')
    return s.length === 2 ? value({ repo: { org: s[0], name: s[1] }}): error('expected')('/', repo)
}

/** @type {(repo: string, branch: string) => Result<ModuleId>} */
const parseRepoAndBranchCommit = (repo, branch) => errorMap(parseRepo(repo), module => value({ repo: module.repo, branch }))

/** @type {(_: string) => Result<ModuleId>} */
const parseGitHubId = id => splitOne(id, '#', parseRepoAndBranchCommit, (_, repo) => parseRepo(repo))

/** @type {(protocol: string, id: string) => Result<ModuleId>} */
const parseProtocolAndId = (protocol, id) => protocol === 'github'
    ? parseGitHubId(id) : error('unknownProtocol')(protocol)

module.exports = {
    /** @type {(_: string) => Result<ModuleId>} */
    parseModuleUrl: url => splitOne(url, ':', parseProtocolAndId, error('expected')),
    /** @type {ErrorMap} */
    errorMap: {
        expected: (c, s) => `expected '${c}' in '${s}'`,
        unknownProtocol: protocol => `unknown protocol '${protocol}'`,
    },
}
