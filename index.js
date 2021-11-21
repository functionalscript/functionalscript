const lib = require('./lib')

/** @type {<F>(c: string, found: (before: string, after: string) => F, notFound: (c: string, source: string) => F) => (source: string) => F} */
const splitOne = (c, found, notFound) => source => {
    const i = source.indexOf(c)
    return i !== -1 ? found(source.substring(0, i), source.substring(i + 1)) : notFound(c, source)
}

/** @type {<T>(f: (_: T) => boolean) => (_: Iterable<T>) => boolean} */
const every = f => i => {
    for (let e of i) {
        if (!f(e)) {
            return false
        }
    }
    return true
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

/**
 * @template T
 * @typedef {<R>(v: (_: T) => R, e: (_: ErrorValue) => R) => R} Result 
 */

/** @type {<T>(_: T) => Result<T>} */
const value = v => vf => vf(v)

/**
 * @typedef {<R, T>(_: (_: T) => R, e: (_: ErrorValue) => R) => R} ErrorResult
 */

/** @type {(e: ErrorValue) => ErrorResult} */
const error = e => (_, ef) => ef(e)

/** @type {(id: ErrorId) => (...params: string[]) => ErrorResult} */
const createError = id => (...params) => error({ id, params })

/** @type {(_: string) => Result<ModuleId>} */
const parseRepo = repo => {
    const s = repo.split('/')
    return s.length === 2 ? value({ repo: { org: s[0], name: s[1] } }) : createError('expected')('/', repo)
}

/** @type {(_: string) => boolean} */
const isCommit = name => name.length === 40 && every(c => "0123456789ABCDEFabcdef".includes(c))(name)

/** @type {(repo: string, branch: string) => Result<ModuleId>} */
const parseRepoAndBranchCommit = (repo, branchCommit) => 
    parseRepo(repo)(
        ({repo}) => value(isCommit(branchCommit) ? { repo, commit: branchCommit } : { repo, branch: branchCommit }), 
        error)

const parseGitHubId = splitOne('#', parseRepoAndBranchCommit, (_, repo) => parseRepo(repo))

/** @type {(protocol: string, id: string) => Result<ModuleId>} */
const parseProtocolAndId = (protocol, id) => protocol === 'github'
    ? parseGitHubId(id) : createError('unknownProtocol')(protocol)

module.exports = {
    every,
    isCommit,
    parseModuleUrl: splitOne(':', parseProtocolAndId, createError('expected')),
    /** @type {ErrorMap} */
    errorMap: {
        expected: (c, s) => `expected '${c}' in '${s}'`,
        unknownProtocol: protocol => `unknown protocol '${protocol}'`,
    },
}
