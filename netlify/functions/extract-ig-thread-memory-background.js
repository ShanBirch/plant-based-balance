// Netlify background-function entry point. Keeping the extractor itself in a
// regular module preserves direct local testing while this suffix grants the
// scheduled production run the longer background execution window.
const extractor = require('./extract-ig-thread-memory');

exports.handler = extractor.handler;
