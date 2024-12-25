import { setEncryptionPassword, transformer } from 'src/encryption/encryption';
import { isRealTime, setRealtime } from 'src/real-time/RealTimeModel';

let PouchDB: any;
let dbEnvironment: 'browser' | 'runtime' | 'react-native';

export function setEnvironment(environment: 'browser' | 'runtime' | 'react-native') {
    const PouchDBFind = require('pouchdb-find');
    if (environment == 'browser') {
        PouchDB = require('pouchdb-browser').default || require('pouchdb-browser');
        PouchDB.plugin(PouchDBFind.default || PouchDBFind);
    } else if (environment == 'runtime') {
        PouchDB = require('pouchdb');
        PouchDB.plugin(PouchDBFind);
    } else if (environment == 'react-native') {
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
    public static databases: { [dbName: string]: PouchDB.Database & DatabaseCustomConfig | null } = {};

    public static async connect(url: string, config: PouchDBConfig): Promise<PouchDB.Database & DatabaseCustomConfig | null> {
        if (!PouchDB) {
            setEnvironment('runtime');
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
                this.databases[config.dbName] = pouchDb;

                // patch for fixing get() method cannot run in v0.76.5 react native
                pouchDb.get = async function (id: string, options?: PouchDB.Core.GetOptions) {
                    return pouchDb.allDocs({ include_docs: true, startkey: id, endkey: id + '\uffff', limit: 1, ...options, }).then((result: any) => {
                        if (result.rows.length) {
                            return result.rows[0].doc;
                        } else {
                            throw new Error('missing');
                        }
                    });
                } as any;

                resolve(pouchDb);
            } catch (error) {
                console.error(`- Database "${config.dbName}" having error while connecting, please check below`);
                console.error((error as any).message);
                console.error((error as any).stack);
                this.databases[config.dbName as string] = null;
                resolve(null);
            }
        });
    }

    public static get(dbName?: string): PouchDB.Database & DatabaseCustomConfig | null {
        if (!dbName) {
            // find the only database
            if (Object.keys(this.databases).length === 1) {
                return this.databases[Object.keys(this.databases)[0]];
            }
            if (Object.keys(this.databases).length === 0) {
                throw new Error('No database connected.');
            }
            throw new Error(
                'There is more than one database connected. Please specify the database name to get.'
            );
        }
        const db = this.databases[dbName];
        if (!db) {
            throw new Error(`Database "${dbName}" not found.`);
        }
        return db;
    }

    public static close(dbName?: string) {
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
        const db = this.databases[dbName];
        if (db) {
            db.close();
            delete this.databases[dbName];
        }
    }
}
