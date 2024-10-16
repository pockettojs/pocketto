import MultipleDatabase from './MultiDatabase';

let performanceMode = false;

export function setPerformanceMode(isPerformanceMode: boolean) {
    performanceMode = isPerformanceMode;
}

export function getPerformanceMode() {
    return performanceMode;
}

export function setMainDatabaseName(dbName: string) {
    MultipleDatabase.dbName = dbName;
}

export function getMainDatabaseName() {
    return MultipleDatabase.dbName;
}