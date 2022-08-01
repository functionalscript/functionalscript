const types = require('../types/module.f.cjs')
const text = require('../../text/module.f.cjs')
const obj = require('../../types/object/module.f.cjs')
const { list } = require('../../types/module.f.cjs')

/** @type {(name: string) => (body: text.Block) => text.Block} */
const struct = name => body => [`struct ${name}`, '{', body, '};']

/** @type {(kv: obj.Entry<types.Definition>) => text.Block} */
const def = ([name, d]) => struct(name)([])

/** @type {(name: string) => (library: types.Library) => text.Block} */
const cpp = name => library => text.curly
    ('namespace')
    (name)
    (list.flatMap(def)(Object.entries(library)))

module.exports = {
    /** @readonly */
    cpp,
}