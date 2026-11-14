import { assertEq } from '../../../../asserts/module.f.js'
import { chunksText } from '../../../../text/marked/module.f.js'
import { _resolve } from '../names/module.f.mjs'
import { _entryChunks, _entryText, _hasEntryChunks, _hasEntryText, _helperText, _intrinsicChunks, _intrinsicText, _refMapChunks, _refMapText } from './module.f.mjs'

export const proof = {
    entry: () => {
        assertEq(_entryText('entry'), chunksText(_entryChunks('entry')))
        assertEq(chunksText(_resolve([_entryText('entry')])), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}')
    },
    presence: () => {
        assertEq(_hasEntryText('presence'), chunksText(_hasEntryChunks('presence')))
        assertEq(chunksText(_resolve([_hasEntryText('presence')])), '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;}')
    },
    // The empty reference map: the body binds its own name, in an arrow
    // called at once, so a read of the empty map answers that same map.
    refMap: () => {
        assertEq(_refMapText('map'), chunksText(_refMapChunks('map')))
        assertEq(chunksText(_resolve([_refMapText('map')])), '(()=>{const $0=($1,$2)=>{const $3=new WeakMap();let $4=1n;const $5=($6,$7)=>{while(true){if($6===undefined){return undefined;}if($7===1n){return $6.value;}$6=$7&1n?$6.one:$6.zero;$7>>=1n;}};const $8=($9,$10,$11)=>{const {value:$12,zero:$13,one:$14}=$9??{};return $10===1n?{value:$11,zero:$13,one:$14}:$10&1n?{value:$12,zero:$13,one:$8($14,$10>>1n,$11)}:{value:$12,zero:$8($13,$10>>1n,$11),one:$14};};const $15=$16=>{const $17=($18,$19)=>{const $20=$3.get($18);const $21=$20===undefined?undefined:$5($16,$20);if($19===undefined){return [$21,$17];}const $22=$20??$4;if($20===undefined){$4+=1n;}$3.set($18,$22);return [$21,$15($8($16,$22,$19))];};return $17;};return $2===undefined?[undefined,$0]:$15(undefined)($1,$2);};return $0;})()')
    },
    intrinsic: () => {
        assertEq(_intrinsicText('slice')('slice'), chunksText(_intrinsicChunks('slice')('slice')))
        assertEq(chunksText(_resolve([_intrinsicText('slice')('slice')])), '($0,$1,$2)=>$0.slice($1,$2)')
    },
    // Each helper's text by its tag is the text its own writer gives.
    helper: () => {
        assertEq(_helperText('entry')('h'), _entryText('h'))
        assertEq(_helperText('hasEntry')('h'), _hasEntryText('h'))
        assertEq(_helperText('refMap')('h'), _refMapText('h'))
        assertEq(_helperText('slice')('h'), _intrinsicText('slice')('h'))
        assertEq(_helperText('charCodeAt')('h'), _intrinsicText('charCodeAt')('h'))
    },
}
