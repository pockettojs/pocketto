import { Model } from 'src/model/Model';
import { DatabaseManager } from 'src/manager/DatabaseManager';

describe('QueryBuilder Sort By', () => {
    class QBSUser extends Model {
        static dbName: string = 'query-builder-sort-by';

        username!: string;
        nickname!: string;
    }

    beforeEach(async () => {
        await DatabaseManager.connect('query-builder-sort-by', { dbName: 'query-builder-sort-by', adapter: 'memory', silentConnect: true, });
    });

    it('should sort the result', async () => {
        await Promise.all([
            QBSUser.create({ username: 'Test1', nickname: '123', }),
            QBSUser.create({ username: 'Test2', nickname: '124', }),
            QBSUser.create({ username: 'Test3', nickname: '125', }),
            QBSUser.create({ username: 'Test4', nickname: '123', }),
            QBSUser.create({ username: 'Test5', nickname: '124', }),
        ]);
        const users = await QBSUser.query().orderBy('username').orderBy('nickname', 'desc').get();
        expect(users[0].username).toEqual('Test3');
        expect(users[1].username).toEqual('Test2');
        expect(users[2].username).toEqual('Test5');
        expect(users[3].username).toEqual('Test1');
        expect(users[4].username).toEqual('Test4');
    });
});