import MultipleDatabase from './MultiDatabase';

let timeSeriesMode = false;

export function setTimeSeriesMode(isTimeSeriesMode: boolean) {
    timeSeriesMode = isTimeSeriesMode;
}

export function getTimeSeriesMode() {
    return timeSeriesMode;
}

export function setMainDatabaseName(dbName: string) {
    MultipleDatabase.dbName = dbName;
}

export function getMainDatabaseName() {
    return MultipleDatabase.dbName;
}