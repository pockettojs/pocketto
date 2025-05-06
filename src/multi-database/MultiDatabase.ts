import { DatabaseCustomConfig, DatabaseManager, PouchDBConfig, syncDatabases } from '..';

export type MultiDatabaseConfig = {
    name: string;
    period: string;
    localDatabaseName: string;
    config: PouchDBConfig;
    remoteConfig?: PouchDBConfig;
};


export class MultipleDatabase {
    static dbName: string = 'master'; // Main database name
    static adapter: string = 'idb'; // Default adapter for the database

    // Store daily data like Transaction, Order, etc.
    static databases: Map<string, MultiDatabaseConfig> = new Map();

    static async boot() {
        const db = await DatabaseManager.connect(this.dbName, { dbName: this.dbName, adapter: this.adapter, silentConnect: true, });
        const data = await db?.get(`MultipleDatabases.${this.dbName}`).catch(() => undefined) as { databases: MultiDatabaseConfig[] } | undefined;
        if (!data) {
            await db?.put({
                _id: `MultipleDatabases.${this.dbName}`,
                databases: [],
            });
        }
        for (const db of data?.databases || []) {
            if (!this.databases.has(db.period)) {
                try {
                    await DatabaseManager.connect(db.localDatabaseName, db.config);
                } catch (error) {
                    console.error(error);
                }
            }
            this.databases.set(db.period, db);
        }
    }

    static async createDatabase(
        period: string,
        remoteConfig?: PouchDBConfig & { url: string; }
    ): Promise<PouchDB.Database & DatabaseCustomConfig | null> {
        const mainDbName = this.dbName;
        const mainDbConfig = DatabaseManager.databases[mainDbName]?.db.config;
        if (!mainDbConfig) throw new Error(`Database ${mainDbName} not found`);

        const periodDbName = `${mainDbName}-${period}`;
        const periodDbConfig = {
            adapter: mainDbConfig.adapter,
            password: mainDbConfig.auth?.password,
            silentConnect: mainDbConfig.silentConnect,
            dbName: periodDbName,
        };
        let periodDb: PouchDB.Database & DatabaseCustomConfig | null;
        try {
            periodDb = DatabaseManager.get(periodDbName);
        } catch (error) {
            periodDb = null;
        }
        if (!periodDb) {
            periodDb = await DatabaseManager.connect(
                periodDbName,
                periodDbConfig
            ) as PouchDB.Database & DatabaseCustomConfig;
            periodDb!.config = periodDbConfig;
        }

        let remote = null;
        if (remoteConfig && remoteConfig?.dbName && periodDb?.config?.dbName) {
            remote = await DatabaseManager.connect(remoteConfig.url, remoteConfig) as PouchDB.Database & DatabaseCustomConfig;
            syncDatabases(periodDb.config?.dbName, remoteConfig.dbName);
            if (!remoteConfig.silentConnect) {
                console.log(`Syncing ${periodDb.config?.dbName} with ${remoteConfig.dbName}`);
            }
        }

        const result = {
            name: mainDbName,
            period,
            localDatabaseName: `${mainDbName}-${period}`,
            config: periodDbConfig,
            remoteConfig,
        };

        const db = await DatabaseManager.connect(this.dbName, { dbName: this.dbName, adapter: this.adapter, silentConnect: true, });
        const data = await db?.get(`MultipleDatabases.${this.dbName}`).catch(() => ({ databases: [], })) as { databases: MultiDatabaseConfig[] };
        const isExist = this.databases.get(period);
        if (!isExist) {
            this.databases.set(period, result);
            data?.databases.push(result);
            await db?.post(data);
        } else {
            this.databases.set(period, result);
            const index = data.databases.findIndex(db => db.period === period);
            data.databases[index] = result;
            await db?.put(data);
        }

        return remote;
    }

    static async getDatabase(period: string): Promise<MultiDatabaseConfig | undefined> {
        return this.databases.get(period);
    }
}