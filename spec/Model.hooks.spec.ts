import { DatabaseManager } from 'src/manager/DatabaseManager';
import { Model } from 'src/model/Model';

const dbName = 'model-hooks';

describe('Model Hooks', () => {
    class ExtendedModel extends Model {
        static dbName = dbName;

        public static async beforeSave(model: ExtendedModel): Promise<ExtendedModel> {
            return model;
        }

        public static async afterSave(model: ExtendedModel): Promise<ExtendedModel> {
            return model;
        }
    }

    class User extends ExtendedModel {
        static dbName = dbName;

        name!: string;
        password?: string;

        public static async beforeSave(model: User): Promise<User> {
            await super.beforeSave(model);
            return model;
        }

        public static async afterSave(model: User): Promise<User> {
            model.setPassword('123456');
            return model;
        }

        public setPassword(password: string): void {
            this.password = password;
        }
    }


    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should be able to run predefined beforeSave hook', async () => {
        const user = new User;
        user.name = 'John';
        spyOn(User, 'beforeSave');
        await user.save();
        expect(User.beforeSave).toHaveBeenCalled();

        const user2 = new User;
        user2.name = 'Jane';
        spyOn(user2, 'setPassword');
        await user2.save();
        expect(user2.setPassword).toHaveBeenCalled();
    });
});
