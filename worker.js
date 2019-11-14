const workerpool = require('workerpool');
const { resolve } = require('path');
const v8 = require('v8');

async function executeScript(path, context) {
    let result = await require(path)(context);
    try {
        v8.serialize(result);
    } catch (err) {
        result = JSON.parse(JSON.stringify(result));
    }
    return result;
}

function invalidateScriptCache(path) {
    delete require.cache[resolve(path)];
}

workerpool.worker({
    executeScript,
    invalidateScriptCache,
});