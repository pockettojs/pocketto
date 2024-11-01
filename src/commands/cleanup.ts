// use node FS to delete side-effect folder & files

import fsPromises from 'node:fs/promises';

const DELETE_PATHS = [
    'dist/node/mocks',
    'dist/node/spec',
    'dist/node/debug',
    'dist/browser/mocks',
    'dist/browser/spec',
    'dist/browser/debug',
];

const main = async () => {
    try {
        const tasks = DELETE_PATHS.map(path => {
            fsPromises.rm(path, { force: true, recursive: true, });
        });
        await Promise.all(tasks);
        // console.log(`success, ${DELETE_PATHS.length} subfolders are deleted`);
    } catch {
        console.error('Failed to clean up, check /src/commands/clean.ts');
    }
};

main();