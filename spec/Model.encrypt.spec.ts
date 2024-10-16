import { DatabaseManager } from 'src/manager/DatabaseManager';
import { setRealtime } from 'src/real-time/RealTimeModel';
import { RepoManager } from 'src/manager/RepoManager';
import { Model } from 'src/model/Model';
import fs from 'fs';
import { QueryBuilder } from 'src/index';

const dbName = 'model-encrypt';

describe('Model Encrypt', () => {
    class EncryptUser extends Model {
        static dbName = dbName;
        static realtimeUpdate = true;

        name!: string;
        password?: string;

        getRandomPassword() {
            return Math.random().toString();
        }
    }

    class TestClass1 extends Model {
        static dbName = dbName;
        static realtimeUpdate = true;

        browser!: string;
        googleAlike?: string;
        math!: string;
    }

    class TestClass2 extends Model {
        static dbName = dbName;
        static realtimeUpdate = true;

        // random 20 fields, 10 fields are number, 10 fields are string
        field1!: number;
        field2!: number;
        field3!: number;
        field4!: number;
        field5!: number;
        field6!: number;
        field7!: number;
        field8!: number;
        field9!: number;
        field10!: number;
        field11!: string;
        field12!: string;
        field13!: string;
        field14!: string;
        field15!: string;
        field16!: string;
        field17!: string;
        field18!: string;
        field19!: string;
        field20!: string;
    }

    let repo: QueryBuilder<EncryptUser>;


    beforeEach(async () => {
        await DatabaseManager.connect(dbName, {
            dbName,
            password: 'hu9fewu9bnf49n0*&(HG(',
            adapter: 'memory',
            silentConnect: true,
        });
        setRealtime(true);
        repo = RepoManager.get(new EncryptUser);
    });

    it('should be able to encrypt a database', async () => {
        repo.raw().changes({
            since: 'now',
            include_docs: true,
            live: true,
        }).on('change', function (change) {
            if (change.doc?._id === 'EncryptUsers.TestEncryptUser') {
                if (change.doc?._rev.includes('1-')) {
                    expect(change.doc).toEqual(jasmine.objectContaining({
                        _id: 'EncryptUsers.TestEncryptUser',
                        name: 'John',
                    }));
                } else {
                    expect(change.doc).toEqual(jasmine.objectContaining({
                        _id: 'EncryptUsers.TestEncryptUser',
                        name: 'Jane',
                    }));
                }
            }
        });

        const user = await EncryptUser.create({
            id: 'TestEncryptUser',
            name: 'John',
        });
        expect(user.id).toBe('TestEncryptUser');
        user.name = 'Jane';
        await user.save();

        await new Promise((res) => setTimeout(res, 1000));
        expect(user).toEqual(jasmine.objectContaining({
            id: 'TestEncryptUser',
            name: 'Jane',
        }));

    });

    it('should able to generate 10 users and query with mango query when encrypted', async () => {
        await Promise.all(new Array(10).fill(0).map(
            () => EncryptUser.create({ name: 'Test' + Math.random(), })
        ));

        // test if mango query still workable when setup crypto pouch
        const users = await EncryptUser.query().where('name', '>', 'Test').get();
        expect(users.length).toBe(10);
    });

    it('should able to query all users when encrypted', async () => {
        const allUsers = await EncryptUser.all();
        expect(allUsers.length).toBe(11);

        const allUsersCount = await EncryptUser.count();
        expect(allUsersCount).toBe(11);
    });

    it('should able to save multiple times', async () => {
        const user = await EncryptUser.create({ name: 'Test' + 0, });
        await EncryptUser.all();
        await EncryptUser.find(user.id) as EncryptUser;
        expect(user.id).toBeTruthy();
        const newName = 'Test' + 1;
        user.name = newName;
        await user.save();
        const dbUser = await EncryptUser.find(user.id) as EncryptUser;
        expect(user.name).toBe(dbUser.name);

        const newName2 = 'Test' + 2;
        user.name = newName2;
        await user.save();
        const dbUser2 = await EncryptUser.find(user.id) as EncryptUser;
        expect(user.name).toBe(dbUser2.name);
    });

    it('should be fast', async () => {
        await Promise.all(new Array(255).fill(0).map(() => EncryptUser.create({
            name: String(Math.random()),
        })));
        await Promise.all(new Array(255).fill(0).map(() => TestClass1.create({
            browser: String(Math.random()),
            googleAlike: String(Math.random()),
            math: String(Math.random()),
        })));
        await Promise.all(new Array(255).fill(0).map(() => TestClass2.create({
            field1: Math.random(),
            field2: Math.random(),
            field3: Math.random(),
            field4: Math.random(),
            field5: Math.random(),
            field6: Math.random(),
            field7: Math.random(),
            field8: Math.random(),
            field9: Math.random(),
            field10: Math.random(),
            field11: String(Math.random()),
            field12: String(Math.random()),
            field13: String(Math.random()),
            field14: String(Math.random()),
            field15: String(Math.random()),
            field16: String(Math.random()),
            field17: String(Math.random()),
            field18: String(Math.random()),
            field19: String(Math.random()),
            field20: String(Math.random()),
        })));
        console.time('find');
        const tests = await TestClass2.all();
        console.timeEnd('find');

        expect(tests.length).toBe(255);
    });

    afterAll(() => {
        fs.rmSync('model-encrypt-encrypted', { recursive: true, force: true, });
    });
});