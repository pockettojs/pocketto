import MultipleDatabase from './MultiDatabase';

export enum ShardingMode {
    TimeSeries = 'time-series',
    None = 'none',
}

export function setMainDatabaseName(dbName: string, adapter: string) {
    MultipleDatabase.dbName = dbName;
    MultipleDatabase.adapter = adapter;
    MultipleDatabase.init();
}

export function getMainDatabaseName() {
    return MultipleDatabase.dbName;
}