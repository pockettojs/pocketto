import { onDocChange } from 'src/real-time/RealTimeModel';
import { setEnvironment } from '.';
import { setRealtime } from '.';
import { getMainDatabaseName, setMainDatabaseName, bootDatabases } from './multi-database/MultiDatabaseConfig';
import { setIdMethod } from './id/Id';

export * from 'src/manager/DatabaseManager';
export * from 'src/manager/RepoManager';
export * from 'src/multi-database/MultiDatabaseConfig';

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
    setMainDatabaseName: setMainDatabaseName,
    getMainDatabaseName: getMainDatabaseName,
    bootDatabases: bootDatabases,
};
