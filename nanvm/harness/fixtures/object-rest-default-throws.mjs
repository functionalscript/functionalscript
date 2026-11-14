// Reached prefix defaults remain required even when every binding is unused.
const fail = () => { throw 'object rest default'; };
const { head: _unused = fail(), ..._rest } = { head: undefined, kept: 1 };
export default 7;
