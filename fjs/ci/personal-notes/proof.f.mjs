import { assert, assertEq } from '../../asserts/module.f.js'
import { canWrite, notesPrefix, onlyPersonalNotes } from './module.f.mjs'

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
        ]))
    },
    outside: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', [
            { filename: 'doc/sasha-gil/a.md' },
            { filename: 'AGENTS.md' },
        ]))
        // Another author's notes are not this author's.
        assert(!onlyPersonalNotes('sasha-gil', 'admin', [{ filename: 'doc/sergey/README.md' }]))
        // A prefix of the login is not the login.
        assert(!onlyPersonalNotes('sasha', 'write', [{ filename: 'doc/sasha-gil/a.md' }]))
    },
    renamedIn: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', [
            { filename: 'doc/sasha-gil/a.md', previous_filename: 'fjs/a.md' },
        ]))
    },
    readOnly: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'read', [{ filename: 'doc/sasha-gil/a.md' }]))
    },
    empty: () => {
        assert(!onlyPersonalNotes('sasha-gil', 'write', []))
    },
}
