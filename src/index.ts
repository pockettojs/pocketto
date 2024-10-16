import { setEnvironment } from '.';
import { setRealtime } from '.';
import { getMainDatabaseName, getPerformanceMode, setMainDatabaseName, setPerformanceMode } from './multi-database/MutliDatabaseConfig';

export * from 'src/manager/DatabaseManager';
export * from 'src/manager/RepoManager';

export * from 'src/model/Model';
export * from 'src/query-builder/QueryBuilder';
export * from 'src/real-time/RealTimeModel';
export * from 'src/real-time/DatabaseSync';
export * from 'src/relationships/RelationshipDecorator';
export * from 'src/model/ModelDecorator';
export * from 'src/helpers/Persistor';

export const Pocketto = {
    setRealtime: setRealtime,
    setEnvironment: setEnvironment,
    setPerformanceMode: setPerformanceMode,
    getPerformanceMode: getPerformanceMode,
    setMainDatabaseName: setMainDatabaseName,
    getMainDatabaseName: getMainDatabaseName,
};
