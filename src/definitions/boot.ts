
export type SinglePocketConfig = {

    /**
     * url of the CouchDB/PouchDB server.
     */
    url: string;
    /**
      * Database name, which can be used in the DatabaseManager.get() method.
      * Default is 'default'.
      */
    dbName?: string;

    /**
     * Password to encrypt the database in your browser.
     * If not set, the database will not be encrypted.
     */
    password?: string;

    /**
     * Adapter to use. Default is 'idb' (IndexedDB) for the browser and 'leveldb' for NodeJS.
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

    /**
     * Name of the sync databases set you wish to sync with.
     * e.g. if you have 2 databases, both set `syncSetName` to "mySyncSet", then they will be synced.
     */
    syncSetName?: string;
};

export type MultiPocketConfig = {
    databases: SinglePocketConfig[];

};

export type GlobalConfig = {
    /**
     * If true, the model will have createdAt and updatedAt fields.
     */
    modelTimestamp?: boolean;


    /**
     * If true, the runtime variable will be updated when the database is updated.
     */
    realtimeUpdate?: boolean;
};