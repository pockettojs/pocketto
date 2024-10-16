// this file will used by the debugger to run the tests
jasmine.DEFAULT_TIMEOUT_INTERVAL = 5 * 60 * 1000;
/* eslint-env node, es6 */
module.exports = {
    'spec_dir': 'spec',
    'spec_files': ['**/*spec.ts',],
    'random': false,
};
