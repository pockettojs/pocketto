import { DatabaseManager } from 'src/manager/DatabaseManager';
import { RepoManager } from 'src/manager/RepoManager';
import { Model } from 'src/model/Model';

describe('Model', () => {
    class MUser extends Model {
        static dbName = 'model';
        static readonlyFields = ['username',];
        static softDelete = false;

        name!: string;
        username?: string;
        password?: string;

        setRandomPassword() {
            this.password = Math.random().toString();
        }
    }

    beforeEach(async () => {
        await DatabaseManager.connect('model', { dbName: 'model', adapter: 'memory', silentConnect: true, });
    });

    it('should be able to create a new model', async () => {
        const user = await MUser.create({
            name: 'new-user',
        });
        expect(user).toBeTruthy();
        expect(user).toEqual(jasmine.objectContaining({
            name: 'new-user',
        }));
        expect(user._meta._rev).toEqual(jasmine.stringMatching('1-'));
    });

    it('should be able to find a model', async () => {
        const createdUser = await MUser.create({
            name: 'new-user2',
        });

        const user = await MUser.find(createdUser.id);

        expect(user).toBeTruthy();
        expect(user).toEqual(jasmine.objectContaining({
            id: createdUser.id,
            name: createdUser.name,
        }));
        expect(user?._meta._rev).toEqual(createdUser._meta._rev);
    });

    it('should be able to save a model', async () => {
        const user = new MUser;
        user.name = 'new-user3';
        user.id = 'new-user3';
        await user.save();


        const savedUser = await MUser.find(user.id as string);
        expect(savedUser).toBeTruthy();
        expect(savedUser).toBeInstanceOf(MUser);
        expect(savedUser).toEqual(user);
    });

    it('should not be save the meta data into database', async () => {
        const user = new MUser;
        user.name = 'new-user4';
        user.id = 'new-user4';
        await user.save();

        const doc = await RepoManager.get(new MUser).getDoc(user.id) as unknown as MUser;
        expect(doc).toBeTruthy();
        expect(doc._meta).not.toBeDefined();
        expect(doc.relationships).not.toBeDefined();
        expect(doc.setRandomPassword).not.toBeDefined();
    });

    it('should be able to delete a model', async () => {
        const user = await MUser.create({
            name: 'new-user5',
        });

        await user.delete();

        const deletedUser = await MUser.find(user.id as string);
        expect(deletedUser).not.toBeTruthy();
    });

    it('should be able to check if a attribute is dirty', () => {
        const user = new MUser;
        user.name = 'new-user6';
        const nameIsDirty = user.isDirty('name');
        expect(nameIsDirty).toEqual(true);

        const modelIsDirty = user.isDirty();
        expect(modelIsDirty).toEqual(true);
    });

    it('should only to set once for readonly field', async () => {
        const OLD_USERNAME = 'old-username';
        const NEW_USERNAME = 'new-username';

        const user = new MUser;
        user.username = OLD_USERNAME;
        user.name = 'new-user7';
        await user.save();

        user.username = NEW_USERNAME;
        await user.save();
        expect(user.username).toEqual(OLD_USERNAME);

        const dbUser = await MUser.find(user.id as string) as MUser;
        expect(dbUser.username).toEqual(OLD_USERNAME);
    });

    it('should be able to replicate a model without id', async () => {
        const user = new MUser;
        user.name = 'new-user8';
        await user.save();

        const replicatedUser = user.replicate();
        replicatedUser.setRandomPassword();
        expect(replicatedUser).toEqual(jasmine.objectContaining({
            name: 'new-user8',
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }));
        expect(replicatedUser.id).not.toBeDefined();
        expect(replicatedUser._meta._rev).not.toBeDefined();
        expect(replicatedUser.password).toBeTruthy();
    });

    it('should be able to check the dirty record based on first time unsave edit', async () => {
        const user = new MUser;
        user.name = 'new-user9';
        await user.save();
        user.name = 'test1';
        user.name = 'test2';
        expect(user.getBeforeDirtyValue('name')).toEqual('new-user9');
    });

    it('should be able to delete multiple user', async () => {
        const ids = [];
        for (let i = 0; i < 10; i++) {
            const user = await MUser.create({
                name: `new-user-test${i}`,
            });
            ids.push(user.id);
        }
        const result = await MUser.where('id', 'in', ids).delete();
        const deleteResult = {} as any;
        for (const id of ids) {
            deleteResult[id] = true;
        }
        expect(result).toEqual(deleteResult);
    });

    it('should be able to search with case insensitve', async () => {
        await MUser.create({
            name: 'new-user10',
            username: 'Raymond',
        });
        const searchedUsers = await MUser.where('username', 'like', 'raymond').get();
        expect(searchedUsers.length).toEqual(1);
        expect(searchedUsers[0].username).toEqual('Raymond');
    });

    it('should be able to remove a field', async () => {
        const user = await MUser.create({
            name: 'new-user11',
            username: 'Raymond',
        });
        await user.removeField('username');
        const dbUser = await MUser.find(user.id as string) as MUser;
        expect(dbUser.username).not.toBeDefined();
    });
});