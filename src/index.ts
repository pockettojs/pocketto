import { onDocChange } from 'src/real-time/RealTimeModel';
import { setEnvironment } from '.';
import { setRealtime } from '.';
import { getMainDatabaseName, getTimeSeriesMode, setMainDatabaseName, setTimeSeriesMode } from './multi-database/MutliDatabaseConfig';
import { setIdMethod } from './id/Id';

export * from 'src/manager/DatabaseManager';
export * from 'src/manager/RepoManager';

export * from 'src/id/Id';
export * from 'src/model/Model';
export * from 'src/query-builder/QueryBuilder';
export * from 'src/real-time/RealTimeModel';
export * from 'src/real-time/DatabaseSync';
export * from 'src/relationships/RelationshipDecorator';
export * from 'src/model/ModelDecorator';
export * from 'src/helpers/Persistor';

export const p = {
    setIdMethod: setIdMethod,
    setRealtime: setRealtime,
    setEnvironment: setEnvironment,
    onDocChange: onDocChange,
    setTimeSeriesMode: setTimeSeriesMode,
    getTimeSeriesMode: getTimeSeriesMode,
    setMainDatabaseName: setMainDatabaseName,
    getMainDatabaseName: getMainDatabaseName,
};
