import { Model } from 'src/model/Model';
import { DatabaseManager } from 'src/manager/DatabaseManager';
import { RepoManager } from 'src/manager/RepoManager';
import { QueryBuilder } from 'src/index';

const DB_NAME = 'test-repo-listen-change';

describe('Repo', () => {
    class User extends Model {
        static dbName = DB_NAME;

        name!: string;
        password?: string;
    }

    let repo: QueryBuilder<User>;

    beforeEach(async () => {
        await DatabaseManager.connect(DB_NAME, { dbName: DB_NAME, adapter: 'memory', silentConnect: true, });
        repo = RepoManager.get(new User);
    });

    it('should listen to change event and update the variable', async () => {
        repo.raw().changes({
            since: 'now',
            include_docs: true,
            live: true,
        }).on('change', function (change) {
            if (change.doc?._id === 'Users.TestListenChangeUser') {
                if (change.doc?._rev.includes('1-')) {
                    expect(change.doc).toEqual(jasmine.objectContaining({
                        _id: 'Users.TestListenChangeUser',
                        name: 'John',
                    }));
                } else if (change.doc?._rev.includes('2-')) {
                    expect(change.doc).toEqual(jasmine.objectContaining({
                        _id: 'Users.TestListenChangeUser',
                        name: 'John Doe',
                    }));
                }
            }
        });

        await repo.create({
            id: 'TestListenChangeUser',
            name: 'John',
        });
        const document = await repo.getDoc('Users.TestListenChangeUser');
        await repo.update({ ...document, name: 'John Doe', });
        const docs = await repo.raw().allDocs({
            include_docs: true,
        });
        expect(docs).toBeTruthy();
        await new Promise((res) => setTimeout(res, 1000));
    });
});