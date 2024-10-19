import MultipleDatabase from './MultiDatabase';

export enum ShardingMode {
    TimeSeries = 'time-series',
    None = 'none',
}

export function setMainDatabaseName(dbName: string) {
    MultipleDatabase.dbName = dbName;
}

export function getMainDatabaseName() {
    return MultipleDatabase.dbName;
}