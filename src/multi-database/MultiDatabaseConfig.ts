import MultipleDatabase from './MultiDatabase';

export enum ShardingMode {
    TimeSeries = 'time-series',
    None = 'none',
}

export async function setMainDatabaseName(dbName: string, adapter: string) {
    MultipleDatabase.dbName = dbName;
    MultipleDatabase.adapter = adapter;
}

export async function bootDatabases() {
    await MultipleDatabase.boot();
}

export function getMainDatabaseName() {
    return MultipleDatabase.dbName;
}