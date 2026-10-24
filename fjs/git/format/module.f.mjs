/**
 * The repository format a `config` declares: the version, the extensions
 * Git 2.43 knows, and the id width that follows — 20 bytes for SHA-1, 32 for
 * SHA-256. {@link tryOidBytes} reads it from the entries
 * [`fjs/git/config`](../config/module.f.js)'s `tryEntries` reads, and
 * {@link oidBytes} from a repository's `config` file.
 *
 * Every reader of an object takes the width as a parameter, so the object
 * store, [`fjs/git/store`](../store/module.f.mjs), never reads the format;
 * a caller asks here first, once it has the repository directory
 * [`fjs/git/repo`](../repo/module.f.mjs)'s `tryCommonDir` finds.
 *
 * @module
 *
 * @import { IoChannel, ReadFile } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Entry } from '../config/types.ts'
 * @import { OidBytes } from '../types.ts'
 */

import { mapStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { under } from '../../path/module.f.mjs'
import { compose } from '../../types/function/module.f.js'
import { map } from '../../types/nullable/module.f.js'
import { lastBool, lastInt, lastValue, tryEntries, values } from '../config/module.f.js'

/**
 * The extensions Git 2.43 reads whatever the version says, as it
 * lowercases them.
 *
 * @type {readonly string[]}
 */
const v0Extensions = ['noop', 'preciousobjects', 'partialclone', 'worktreeconfig']

/**
 * The extensions Git 2.43 reads only under `repositoryformatversion = 1`.
 * Under version 0 a file holding one is refused — `repo version is 0, but
 * v1-only extension found` — and `objectformat`, the key
 * {@link tryOidBytes} is for, is one of them.
 *
 * @type {readonly string[]}
 */
const v1OnlyExtensions = ['noop-v1', 'objectformat']

/**
 * The extensions Git 2.43 knows. Under `repositoryformatversion = 1` Git
 * refuses a repository whose `[extensions]` holds any other key —
 * `unknown repository extension found` — since an extension changes how
 * the repository is read and a reader that ignored one would read it
 * wrongly; {@link tryOidBytes} refuses it for the same reason.
 * `compatobjectformat` is not among them: Git 2.43 refuses it, a later Git
 * knows it, and a newer Git knowing more of them is what keeps this list a
 * version's. Under version 0 an unknown key is ignored, as Git ignores it.
 *
 * @type {readonly string[]}
 */
const knownExtensions = [...v0Extensions, ...v1OnlyExtensions]

/** The hash `extensions.objectFormat` names where the id is 32 bytes wide. */
const sha256 = /** @type {const} */ ('sha256')

/**
 * Whether a value names a hash Git knows, which is what
 * `extensions.objectFormat` must hold. A comparison and not a lookup in a
 * map of the two: a value is any text the file holds, and `toString` or
 * `__proto__` would find a key of `Object.prototype` in an ordinary object
 * and pass for a hash's name.
 *
 * @type {(value: string) => boolean}
 */
const isFormat = value => value === 'sha1' || value === sha256

/**
 * The version of a file that names none: what Git starts its
 * `repository_format` at and leaves there when no
 * `core.repositoryformatversion` sets it. It is no version rather than
 * version 0, and the difference shows — a file holding
 * `extensions.objectFormat` and no version at all is a SHA-1 repository
 * Git opens, where the same file saying `repositoryformatversion = 0` is
 * one it refuses.
 *
 * A file that spells this number is read as though it named no version at
 * all, since Git tells the two apart by the number and nothing else: on
 * reading `-1` it throws the format it read away and starts again, so
 * `repositoryformatversion = -1` beside `objectFormat = sha256` is a
 * SHA-1 repository where `-2` beside the same key is a SHA-256 one.
 */
const noVersion = /** @type {const} */ (-1n)

/**
 * The extensions whose value Git reads as a boolean, refusing a
 * repository whose value is none — `bad boolean config value`. The
 * others take a word: `objectformat` a hash's name, `partialclone` a
 * remote's, and `noop` and `noop-v1` anything, since Git reads neither.
 *
 * @type {readonly string[]}
 */
const booleanExtensions = ['preciousobjects', 'worktreeconfig']

/** What every extension's name begins with, the dot included. */
const extensionsPrefix = /** @type {const} */ ('extensions.')

/**
 * The extension an entry names, or `null` where it names none. Git reads
 * the name off the whole variable — `extensions.` and everything after it
 * — so a subsection is part of the name rather than a section of its own:
 * `[extensions "x"]` with `noop` names the extension `x.noop`, which is
 * none Git knows, and under version 1 Git refuses the repository for it.
 *
 * @type {(entry: Entry) => Nullable<string>}
 */
const extensionAt = ([section, key]) =>
    section === 'extensions' ? key
        : section.startsWith(extensionsPrefix) ? `${section.slice(extensionsPrefix.length)}.${key}`
            : null

/**
 * Whether Git 2.43 knows an extension by this name.
 *
 * @type {(ext: string) => boolean}
 */
const isKnownExtension = ext => knownExtensions.includes(ext)

/**
 * Whether it is one Git reads only under `repositoryformatversion = 1`.
 *
 * @type {(ext: string) => boolean}
 */
const isV1OnlyExtension = ext => v1OnlyExtensions.includes(ext)

/**
 * The extension an entry names, as a list of none or one, so a flatMap
 * over the entries is the extensions they name.
 *
 * @type {(entry: Entry) => readonly string[]}
 */
const extensionsOf = entry => {
    const ext = extensionAt(entry)
    return ext === null ? [] : [ext]
}

/**
 * Whether every `[extensions]` value the file holds is one Git reads: a
 * boolean where the extension takes one, and a hash's name where the
 * extension is `objectFormat`, which is case-sensitive as Git reads it. An
 * extension under a subsection is a name Git knows none of, so it has no
 * value Git reads either and none is asked of it.
 *
 * @type {(entries: readonly Entry[]) => boolean}
 */
const extensionValuesRead = entries =>
    booleanExtensions.every(ext => lastBool(entries, 'extensions', ext)[0] === 'ok')
        && values(entries, 'extensions', 'objectformat').every(isFormat)

/**
 * The id width a repository's `config` names, from its entries as
 * [`fjs/git/config`](../config/module.f.js)'s `tryEntries` reads them, or
 * `null` where the file is one Git refuses. 32 bytes needs
 * `extensions.objectFormat = sha256` under `repositoryformatversion = 1`,
 * which is what `git init --object-format=sha256` writes; everything else
 * Git opens is 20, the default `git init` writes with no `[extensions]`
 * section at all.
 *
 * Git reads the file a line at a time and judges each value as it comes to
 * it, so these refusals are of any assignment and not only of the last:
 *
 * - A `repositoryformatversion` that spells no number, as `abc` does.
 * - An `objectFormat` naming a hash Git does not know, `SHA256` included,
 *   the value being case-sensitive.
 * - A boolean extension whose value is no boolean.
 *
 * The version that wins is the last, as the last value wins for Git, and
 * it is read as a number rather than as text: `01`, `+1` and `0x1` are
 * version 1, and `1k` is 1024. What the version then decides:
 *
 * - Over 1 refuses the file — `Expected git repo version <= 1`.
 * - 1 or more refuses an extension Git does not know — `unknown repository
 *   extension found`. A subsection is part of an extension's name rather
 *   than a section of its own, so `[extensions "x"]` names no extension
 *   Git knows whatever key it holds.
 * - 0 refuses a key Git reads only under version 1, `objectFormat` among
 *   them — `repo version is 0, but v1-only extension found`.
 * - {@link noVersion}, which a file naming no version has and a file
 *   spelling `-1` has too, refuses neither and gives up the format it
 *   read: SHA-1, whatever `objectFormat` said.
 * - Any other version below 0, which Git allows, refuses neither and keeps
 *   the format `objectFormat` named.
 *
 * @type {(entries: readonly Entry[]) => Nullable<OidBytes>}
 */
export const tryOidBytes = entries => {
    if (!extensionValuesRead(entries)) { return null }
    // Each version spells a number or refuses the file, and the last one
    // spells the version; a file that spells none has none.
    const [t, last] = lastInt(entries, 'core', 'repositoryformatversion')
    if (t === 'error') { return null }
    const version = last ?? noVersion
    if (version > 1n) { return null }
    const exts = entries.flatMap(extensionsOf)
    if (version >= 1n && !exts.every(isKnownExtension)) { return null }
    if (version === 0n && exts.some(isV1OnlyExtension)) { return null }
    // The hash is what the last `objectFormat` names whatever the version,
    // since Git reads the key at every one — and nothing, where the format
    // Git read was thrown away.
    // Every `objectFormat` the file holds names a hash, or the file is
    // already refused, so the last one is the repository's and 20 is both
    // the other hash's width and what a file naming no format has.
    return version !== noVersion && lastValue(entries, 'extensions', 'objectformat') === sha256 ? 32 : 20
}

/**
 * The id width a `config` file's text names, or `null` where Git refuses
 * the file: a line it cannot read, or a repository format it does not
 * open.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
const widthOf = compose(tryEntries)(map(tryOidBytes))

/**
 * The repository's id width, from its `config`: 20 bytes for SHA-1, 32
 * for SHA-256, or `null` where the file is one Git refuses — a format it
 * does not know, the extension under `repositoryformatversion = 0`, an
 * extension Git does not know, a boolean extension whose value is none, a
 * bad line. A `config` that cannot be read is the channel's, since a
 * directory without one is no repository.
 *
 * @type {(dir: string) => Effect<ReadFile, Nullable<OidBytes>, IoChannel>}
 */
export const oidBytes = dir => mapStep(readUtf8File(under(dir, 'config')), widthOf)
