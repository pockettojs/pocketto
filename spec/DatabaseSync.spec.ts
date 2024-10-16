import { Model, setDefaultDbName } from 'src/index';
import { DatabaseManager } from '../src/manager/DatabaseManager';
import { syncDatabases } from 'src/real-time/DatabaseSync';


describe('DatabaseSync', () => {
    class DatabaseSyncTestUser extends Model {
        public static dbName = 'test';
        public static collectionName = 'SyncUsers';
        public username!: string;
    }

    it('should be able to sync a database', async () => {
        await DatabaseManager.connect('test', {
            dbName: 'test',
            adapter: 'memory',
            silentConnect: true,
        });
        await DatabaseManager.connect('test2', {
            dbName: 'test2',
            adapter: 'memory',
            silentConnect: true,
        });
        syncDatabases('test', 'test2');

        const user = await DatabaseSyncTestUser.create({
            id: 'Test1',
            username: 'John',
        }) as DatabaseSyncTestUser;
        setDefaultDbName('test2');
        const user2 = await DatabaseSyncTestUser.find('Test1') as DatabaseSyncTestUser;
        expect(user.id).toEqual(user2.id);
        expect(user._meta._rev).toEqual(user2._meta._rev);
        expect(user.username).toEqual(user2.username);
    });
});