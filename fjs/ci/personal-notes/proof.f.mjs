import { assert, assertEq } from '../../asserts/module.f.js'
import { canWrite, notesPrefix, onlyPersonalNotes } from './module.f.js'

export const proof = {
    prefix: () => {
        assertEq(notesPrefix('sasha-gil'), 'doc/sasha-gil/')
    },
    permissions: () => {
        assert(canWrite('admin'))
        assert(canWrite('write'))
        assert(!canWrite('read'))
        assert(!canWrite('none'))
    },
    notes: () => {
        assert(onlyPersonalNotes('sasha-gil', 'write', [
            { filename: 'doc/sasha-gil/wasm/README.md' },
            { filename: 'doc/sasha-gil/a.md', previous_filename: 'doc/sasha-gil/b.md' },
        ], 2))
    },
    outside: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', [
            { filename: 'doc/sasha-gil/a.md' },
            { filename: 'AGENTS.md' },
        ], 2))
        // Another author's notes are not this author's.
        assert(!onlyPersonalNotes('sasha-gil', 'admin', [{ filename: 'doc/sergey/README.md' }], 1))
        // A prefix of the login is not the login.
        assert(!onlyPersonalNotes('sasha', 'write', [{ filename: 'doc/sasha-gil/a.md' }], 1))
    },
    renamedIn: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', [
            { filename: 'doc/sasha-gil/a.md', previous_filename: 'fjs/a.md' },
        ], 1))
    },
    readOnly: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'read', [{ filename: 'doc/sasha-gil/a.md' }], 1))
    },
    truncated: () => {
        // The REST API stops at 3,000 files: a list shorter than the count is refused.
        assert(!onlyPersonalNotes('sasha-gil', 'write', [{ filename: 'doc/sasha-gil/a.md' }], 3001))
    },
    empty: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', [], 0))
    },
}
