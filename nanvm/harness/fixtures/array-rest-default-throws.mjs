// A reached prefix default is required even when both head and tail are unused.
const fail = () => { throw 'array rest default'; };
const [unused = fail(), ...tail] = [undefined, 1];
export default 7;
