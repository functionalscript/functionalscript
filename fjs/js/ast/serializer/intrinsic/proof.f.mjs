import { assertEq } from '../../../../asserts/module.f.js'
import { chunksText } from '../../../../text/marked/module.f.mjs'
import { _resolve } from '../../../../compiler/serializer/names/module.f.mjs'
import { _entryChunks, _entryText, _hasEntryChunks, _hasEntryText, _intrinsicChunks, _intrinsicText } from './module.f.mjs'

export const proof = {
    entry: () => {
        assertEq(_entryText('entry'), chunksText(_entryChunks('entry')))
        assertEq(chunksText(_resolve([_entryText('entry')])), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}')
    },
    presence: () => {
        assertEq(_hasEntryText('presence'), chunksText(_hasEntryChunks('presence')))
        assertEq(chunksText(_resolve([_hasEntryText('presence')])), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;}')
    },
    intrinsic: () => {
        assertEq(_intrinsicText('slice')('slice'), chunksText(_intrinsicChunks('slice')('slice')))
        assertEq(chunksText(_resolve([_intrinsicText('slice')('slice')])), '($0,$1,$2)=>$0.slice($1,$2)')
    },
}
