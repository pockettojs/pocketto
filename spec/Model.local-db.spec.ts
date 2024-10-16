import { DatabaseManager } from 'src/manager/DatabaseManager';
import { Model } from 'src/model/Model';

const dbName = 'model-local-db-name';

describe('Model Local DB', () => {
    class LocalUser extends Model {
        static dbName = dbName;

        name!: string;
        password?: string;
    }

    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName: dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should be able to find a model using query builder', async () => {
        const createdUser = await LocalUser.create({
            name: 'new-user2',
        });

        const userFromMangoQuery = await LocalUser.query().where('id', '=', createdUser.id).first();
        expect(userFromMangoQuery).toBeTruthy();
        expect(userFromMangoQuery).toEqual(createdUser);
    });
});