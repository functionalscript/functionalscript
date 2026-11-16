// A trailing high surrogate has no low surrogate to complete its scalar.
export default encodeURIComponent('a\ud800');
