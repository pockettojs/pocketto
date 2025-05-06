import { setEncryptionPassword, transformer } from 'src/encryption/encryption';
import { Utc } from 'src/helpers/Utc';
import { isRealTime, setRealtime } from 'src/real-time/RealTimeModel';

let PouchDB: any;
let dbEnvironment: 'browser' | 'runtime' | 'react-native';

export function enableCacheDatabase(enable: boolean) {
    DatabaseManager.enableCache = enable;
}

export async function setEnvironment(environment: 'browser' | 'runtime' | 'react-native') {
    if (environment == 'browser') {
        return new Promise((resolve) => {
            import('pouchdb-find').then((PouchDBFindModule) => {
                const PouchDBFind = PouchDBFindModule ? PouchDBFindModule.default : PouchDBFindModule;
                import('pouchdb-browser').then((PouchDBBrowserModule) => {
                    PouchDB = PouchDBBrowserModule.default ? PouchDBBrowserModule.default : PouchDBBrowserModule;
                    PouchDB.plugin(PouchDBFind);
                    resolve(PouchDB);
                });
            });
        });
    } else if (environment == 'runtime') {
        const PouchDBFind = require('pouchdb-find');
        PouchDB = require('pouchdb');
        PouchDB.plugin(PouchDBFind);
    } else if (environment == 'react-native') {
        const PouchDBFind = require('pouchdb-find');
        PouchDB = require('pouchdb');
        PouchDB.plugin(PouchDBFind);
        // require('react-native-get-random-values');
        // const SQLiteAdapterFactory = require('pouchdb-adapter-react-native-sqlite');
        // const SQLite = require('react-native-sqlite-2');
        // const SQLiteAdapter = SQLiteAdapterFactory(SQLite);
        // PouchDB.plugin(SQLiteAdapter);
    }
    dbEnvironment = environment;
}

export const DEFAULT_DB_NAME = 'default';

export type PouchDBConfig = {
    /**
     * Database name, which can be used in the DatabaseManager.get() method.
     * Default is 'default'.
     */
    dbName?: string;

    /**
     * Password to encrypt the database in your browser.
     * If not set, the database will not be encrypted.
     */
    encryption?: boolean;

    /**
     * Encryption password to encrypt the database in your browser.
     * If not set, default using `auth` password.
     */
    encryptionPassword?: string;

    /**
     * Adapter to use. Default is 'idb' (IndexedDB) for the browser and 'leveldb' for Node/Deno/Bun.
     * 'memory' | 'http' | 'idb' | 'leveldb' | 'websql'
     */
    adapter?: string;

    /**
     * If true, the connection will not be logged in the console.
     * Default is false.
     */
    silentConnect?: boolean;

    /**
     * Authentication for the online CouchDB.
     */
    auth?: {
        username: string;
        password: string;
    };
};

export type DatabaseCustomConfig = {
    adapter: string;
    transform: (transformer: {
        incoming: (doc: object) => object;
        outgoing: (doc: object) => object;
    }) => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    hasPassword: boolean;
    config: PouchDBConfig;
};

export class DatabaseManager {
    public static databases: Record<string, {
        db: PouchDB.Database & DatabaseCustomConfig;
        lastAccess: string;
    }> = {};
    public static enableCache = true;

    public static async connect(url: string, config: PouchDBConfig): Promise<PouchDB.Database & DatabaseCustomConfig | null> {
        if (!dbEnvironment) {
            const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
            const isRuntime = typeof process !== 'undefined' && process.versions && process.versions.node;
            if (isBrowser) {
                await setEnvironment('browser');
            }
            else if (isRuntime) {
                await setEnvironment('runtime');
            }
            else {
                await setEnvironment('react-native');
            }
        }
        if (config.adapter == 'memory') {
            const PouchDBAdapterMemory = require('pouchdb-adapter-memory');
            PouchDB.plugin(PouchDBAdapterMemory);
        }
        if (isRealTime) {
            setRealtime(true);
        }
        return new Promise(async (resolve) => {
            try {

                let pouchConfig = {} as { adapter: string; auth?: { username: string; password: string; }; skip_setup?: boolean; };
                if (config.adapter) {
                    pouchConfig = { adapter: config.adapter, };
                }
                if (!config.dbName) {
                    config.dbName = DEFAULT_DB_NAME;
                }
                if (config.auth) {
                    pouchConfig.skip_setup = true;
                }
                if (url.startsWith('http')) {
                    config.adapter = 'http';
                }
                let connectionUrl = url;
                if (config.adapter == 'http' && config.auth) {
                    const protocol = url.split('://')[0];
                    connectionUrl = url.replace(`${protocol}://`, `${protocol}://` + config.auth.username + ':' + config.auth.password + '@');
                }
                const pouchDb = new PouchDB(connectionUrl, pouchConfig) as unknown as PouchDB.Database & DatabaseCustomConfig;
                if (!config.silentConnect) {
                    console.log(`- Connected to PouchDB/CouchDB "${config.dbName}": ${url}`);
                    console.log(`- Adapter: ${pouchDb.adapter}`);
                }
                if (config.encryption) {
                    pouchDb.hasPassword = true;
                    await setEncryptionPassword(config.encryptionPassword || config.auth?.password || '', config.dbName || 'default');
                    PouchDB.plugin(require('transform-pouch'));
                    const newTransformer = { ...transformer, dbName: config.dbName || 'default', };
                    await pouchDb.transform(newTransformer);
                }

                if (!this.databases) this.databases = {};
                if (!config.dbName) {
                    config.dbName = DEFAULT_DB_NAME;
                }
                (pouchDb as PouchDB.Database & DatabaseCustomConfig).config = config;
                if (this.enableCache) {
                    this.databases[config.dbName] = {
                        db: pouchDb,
                        lastAccess: new Utc().now(),
                    };
                }

                // patch for fixing get() method cannot run in v0.76.5 react native
                if (dbEnvironment == 'react-native') {
                    pouchDb.get = async function (id: string, options?: PouchDB.Core.GetOptions) {
                        return pouchDb.allDocs({ include_docs: true, startkey: id, endkey: id + '\uffff', limit: 1, ...options, }).then((result: any) => {
                            if (result.rows.length) {
                                return result.rows[0].doc;
                            } else {
                                throw new Error('missing');
                            }
                        });
                    } as any;
                }

                resolve(pouchDb);
            } catch (error) {
                console.error(`- Database "${config.dbName}" having error while connecting, please check below`);
                console.error((error as any).message);
                console.error((error as any).stack);
                delete this.databases[config.dbName as string];
                resolve(null);
            }
        });
    }

    public static get(dbName?: string): PouchDB.Database & DatabaseCustomConfig | null {
        if (!this.enableCache) {
            return null;
        }
        if (!dbName) {
            // find the only database
            if (Object.keys(this.databases).length === 1) {
                this.databases[Object.keys(this.databases)[0]].lastAccess = new Utc().now();
                return this.databases[Object.keys(this.databases)[0]].db;
            }
            if (Object.keys(this.databases).length === 0) {
                throw new Error('No database connected.');
            }
            throw new Error(
                'There is more than one database connected. Please specify the database name to get.'
            );
        }
        const db = this.databases[dbName].db;
        if (db) {
            this.databases[dbName].lastAccess = new Utc().now();
        }
        if (!db) {
            throw new Error(`Database "${dbName}" not found.`);
        }
        return db;
    }

    public static close(dbName?: string) {
        if (!this.enableCache) {
            return null;
        }
        if (!dbName) {
            // find the only database
            if (Object.keys(this.databases).length === 1) {
                dbName = Object.keys(this.databases)[0];
            } else if (Object.keys(this.databases).length === 0) {
                throw new Error('No database connected.');
            } else {
                throw new Error(
                    'There is more than one database connected. Please specify the database name to close.'
                );
            }
        }
        const db = this.databases[dbName].db;
        if (db) {
            db.close().catch((error: any) => {
                console.error(`- Database "${dbName}" having error while closing, please check below`);
                console.error(error.message);
                console.error(error.stack);
            });
            delete this.databases[dbName];
        }
    }
}
