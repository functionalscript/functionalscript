import { assert, assertEq } from '../../asserts/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { examples } from '../examples/module.f.js'
import { parsed, stageDemo } from './module.f.mjs'

export const proof = {
    stageDemo: () => {
        const demo = stageDemo({ intro: 'Shows the source.', name: 'stage' })(text => [['p', `seen ${text}`]])
        assertEq(demo.init, examples[0][1])
        const shown = htmlToString(demo.view('export default 1;'))
        assert(shown.includes('<p>Shows the source.</p>'), shown)
        assert(shown.includes('<label for="stage">Source </label>'), shown)
        assert(shown.includes('<textarea id="stage" name="stage" rows="8" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">export default 1;</textarea>'), shown)
        assertEq(shown.split('<option value=').length - 1, examples.length)
        assert(shown.includes('<span data-token="keyword">export</span>'), shown)
        assert(shown.endsWith('<p>seen export default 1;</p></div>'), shown)
    },
    parsed: () => {
        const imports = parsed(module => ok(module.imports.length))
        assertEq(JSON.stringify(imports('import a from "a";\nexport default a;')), '["ok",1]')
        assertEq(JSON.stringify(imports('export default "\\x41";')), '["error","unexpected token"]')
        const refusing = parsed(() => error('the stage refuses'))
        assertEq(JSON.stringify(refusing('export default 1;')), '["error","the stage refuses"]')
    },
}
