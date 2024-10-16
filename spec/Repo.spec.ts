import { Model } from 'src/model/Model';
import { DatabaseManager } from 'src/manager/DatabaseManager';
import { ApiHostManager } from 'src/manager/ApiHostManager';
import { RepoManager } from 'src/manager/RepoManager';
import { QueryBuilder } from 'src/index';

describe('Repo', () => {
    class User extends Model {
        static dbName = 'repo';

        name!: string;
        password?: string;
    }

    class UserTestApi extends Model {
        static dbName = 'repo';
        static apiName = 'default';
        static apiResource = 'users';

        name!: string;
        password?: string;
    }

    let repo: QueryBuilder<User>;
    let userTestApiRepo: QueryBuilder<UserTestApi>;

    beforeEach(async () => {
        await DatabaseManager.connect('repo', { dbName: 'repo', adapter: 'memory', silentConnect: true, });
        ApiHostManager.addHost('http://pocket.test/');
        repo = RepoManager.get(new User);
        userTestApiRepo = RepoManager.get(new UserTestApi);
    });

    it('should be able to create document via repo', async () => {
        const result = await repo.create({
            id: 'User0',
            name: 'John',
        });
        expect(result).toEqual(jasmine.objectContaining({
            ok: true,
            id: 'Users.User0',
        }));

        const doc = await repo.getDoc('User0');
        expect(doc).toEqual(jasmine.objectContaining({
            id: 'Users.User0',
            name: 'John',
        }));
    });

    it('should be able to create document via repo without model name prefix', async () => {
        const result = await repo.create({
            id: 'User1',
            name: 'John',
        });
        expect(result).toEqual(jasmine.objectContaining({
            ok: true,
            id: 'Users.User1',
        }));

        const doc = await repo.getDoc('User1');
        expect(doc).toEqual(jasmine.objectContaining({
            id: 'Users.User1',
            name: 'John',
        }));
    });

    it('should be able to update document via repo', async () => {
        await repo.create({
            id: 'User2',
            name: 'Jane',
        });
        const doc = await repo.getDoc('User2');
        expect(doc).toEqual(jasmine.objectContaining({
            id: 'Users.User2',
            name: 'Jane',
        }));
        const result = await repo.update({ ...doc, name: 'Jack', });
        expect(result).toEqual(jasmine.objectContaining({
            ok: true,
            id: 'Users.User2',
        }));

        const updatedDoc = await repo.getDoc('User2');
        expect(updatedDoc).toEqual(jasmine.objectContaining({
            id: 'Users.User2',
            name: 'Jack',
        }));
    });

    it('should be able to delete document via repo', async () => {
        await repo.create({
            id: 'User3',
            name: 'John',
        });
        const doc = await repo.getDoc('User3');
        expect(doc).toEqual(jasmine.objectContaining({
            id: 'Users.User3',
            name: 'John',
        }));
        const result = await repo.deleteOne('User3');
        expect(result).toEqual(jasmine.objectContaining({
            ok: true,
            id: 'Users.User3',
        }));

        try {
            await repo.getDoc('User3');
        } catch (e) {
            expect(e).toEqual(jasmine.objectContaining({
                status: 404,
            }));
        }
    });

    it('should not be able to get document via repo if it does not exist', async () => {
        try {
            await repo.getDoc('Users.User4');
        } catch (e) {
            expect(e).toEqual(jasmine.objectContaining({
                status: 404,
            }));
        }
    });

    it('should not be able to delete document via repo if it does not exist', async () => {
        try {
            await repo.deleteOne('Users.User5');
        } catch (e) {
            expect(e).toEqual(new Error('Document not found'));
        }
    });

    it('should return undefined when find document which does not exist', async () => {
        const doc = await repo.getDoc('Users.NonExistingUser');
        expect(doc).toEqual(undefined);
    });

    it('should be able to create document via repo with api name', async () => {
        const apiUser = await userTestApiRepo.create({
            id: 'test-api-user',
            name: 'John',
        });
        expect(apiUser).toEqual(jasmine.objectContaining({
            ok: true,
            id: 'UserTestApis.test-api-user',
            rev: jasmine.any(String),
        }));
    });
});