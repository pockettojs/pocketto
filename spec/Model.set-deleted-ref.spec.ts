import { DatabaseManager } from 'src/manager/DatabaseManager';
import { Model } from 'src/model/Model';

const dbName = 'model-hooks';

describe('Model', () => {
    class User extends Model {
        static dbName = dbName;

        name!: string;
        password?: string;

        getRandomPassword() {
            return Math.random().toString();
        }
    }

    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should not be able to save new reference', async () => {
        const user = new User;
        user.name = 'John';
        await user.save();

        const clonedUser = { ...user, };
        await user.delete();

        const savingClonedUser = new User;
        savingClonedUser.fill(clonedUser);
        delete (savingClonedUser as any).id;
        delete (savingClonedUser as any)._meta._rev;
        await savingClonedUser.save();
        expect(savingClonedUser._meta._rev).not.toBe(clonedUser._meta._rev);

    });
});