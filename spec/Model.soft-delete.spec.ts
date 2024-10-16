import { DatabaseManager } from 'src/manager/DatabaseManager';
import { Model } from 'src/model/Model';

const dbName = 'model-soft-delete';

describe('Model Soft Delete', () => {
    class SoftUser extends Model {
        static dbName = dbName;
        static softDelete = true;

        name!: string;
        password?: string;
    }

    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName: dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should be able to find a model using trash feature', async () => {
        const user = await SoftUser.create({
            name: 'taylor',
        });
        expect(user).toBeInstanceOf(SoftUser);
        expect(user.id).toBeDefined();
        expect(user.name).toBe('taylor');
        await user.delete();
        const foundUser = await SoftUser.withTrashed().where('name', 'taylor').first();
        expect(foundUser).toBeInstanceOf(SoftUser);
        expect(foundUser?.id).toBeDefined();
        expect(foundUser?.name).toBe('taylor');

        const unfoundUser = await SoftUser.withoutTrashed().where('name', 'taylor').first();
        expect(unfoundUser).toBeUndefined();

        const foundUser2 = await SoftUser.onlyTrashed().where('name', 'taylor').first();
        expect(foundUser2).toBeInstanceOf(SoftUser);
        expect(foundUser2?.id).toBeDefined();
        expect(foundUser2?.name).toBe('taylor');
    });

    it('should be able to restore a model', async () => {
        const user = await SoftUser.create({
            name: 'byran',
        });
        expect(user).toBeInstanceOf(SoftUser);
        expect(user.id).toBeDefined();
        expect(user.name).toBe('byran');
        await user.delete();
        const foundUser = await SoftUser.withTrashed().where('name', 'byran').first();
        expect(foundUser).toBeInstanceOf(SoftUser);
        expect(foundUser?.id).toBeDefined();
        expect(foundUser?.name).toBe('byran');
        await foundUser?.restore();
        const restoredUser = await SoftUser.where('name', 'byran').first();
        expect(restoredUser).toBeInstanceOf(SoftUser);
        expect(restoredUser?.id).toBeDefined();
        expect(restoredUser?.name).toBe('byran');
    });
});