import { DatabaseCustomConfig, DatabaseManager, PouchDBConfig, syncDatabases } from '..';

type MultiDatabaseConfig = {
    name: string;
    period: string;
    localDatabaseName: string;
    config: PouchDBConfig;
};


export default class MultipleDatabase {
    static dbName: string = 'master'; // Main database name
    static adapter: string = 'idb'; // Default adapter for the database

    // Store daily data like Transaction, Order, etc.
    static databases: MultiDatabaseConfig[] = [];

    static async boot() {
        const db = await DatabaseManager.connect(this.dbName, { dbName: this.dbName, adapter: this.adapter, silentConnect: true, });
        const data = await db?.get(`MultipleDatabases.${this.dbName}`).catch(() => undefined) as { databases: MultiDatabaseConfig[] } | undefined;
        if (!data) {
            await db?.put({
                _id: `MultipleDatabases.${this.dbName}`,
                databases: [],
            });
        }
        this.databases = data?.databases || [];

        await Promise.all(this.databases.map(async (db) => {
            try {
                await DatabaseManager.connect(db.localDatabaseName, db.config);
            } catch (error) {
                console.error(error);
            }
        }));
    }

    static async createDatabase(
        period: string,
        remoteDatabaseCreation?: (periodDbConfig: PouchDBConfig) => PouchDBConfig | Promise<PouchDBConfig | undefined>
    ): Promise<MultiDatabaseConfig> {
        const mainDbName = this.dbName;
        const mainDbConfig = DatabaseManager.databases[mainDbName]?.config;
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

        const remoteDbConfig = await remoteDatabaseCreation?.(periodDbConfig);
        if (remoteDbConfig?.dbName && periodDb?.config?.dbName) {
            await DatabaseManager.connect(remoteDbConfig.dbName, remoteDbConfig);
            syncDatabases(periodDb.config?.dbName, remoteDbConfig.dbName);
        }

        const result = {
            name: mainDbName,
            period,
            localDatabaseName: `${mainDbName}-${period}`,
            config: periodDbConfig,
        };

        const db = await DatabaseManager.connect(this.dbName, { dbName: this.dbName, adapter: this.adapter, silentConnect: true, });
        const data = await db?.get(`MultipleDatabases.${this.dbName}`) as { databases: MultiDatabaseConfig[] };
        const isExist = data?.databases.find((db: MultiDatabaseConfig) => db.period === period);
        if (!isExist) {
            data?.databases.push(result);
            await db?.put(data);
        }

        return result;
    }

    static async getDatabase(period: string): Promise<MultiDatabaseConfig | undefined> {
        return this.databases.find(db => db.period === period);
    }
}