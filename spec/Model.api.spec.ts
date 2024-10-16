import { DatabaseManager } from 'src/manager/DatabaseManager';
import { ApiHostManager } from 'src/manager/ApiHostManager';
import { ApiRepo } from 'src/repo/ApiRepo';
import { APIAutoConfig } from 'src/definitions/APIAutoConfig';
import { server } from '../mocks/server';
import { Model } from 'src/model/Model';
import { ModelType } from 'src/definitions/Model';

const dbName = 'model-api';

describe('Model API', () => {
    class ApiUser extends Model {
        static dbName = dbName;
        static apiName = 'pocket-backend';
        static apiResource = 'users';
        static apiAuto = {
            create: true,
            update: true,
            delete: true,
            softDelete: true,
            fetchWhenMissing: true,
        } as APIAutoConfig;

        name!: string;
        password?: string;

        async setRandomPassword() {
            const result = await this.api('random-password') as Partial<ModelType<this>>;
            this.fill(result);
        }
    }

    beforeAll(() => {
        server.listen();
    });

    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
        ApiHostManager.addHost('http://pocket.test/', 'pocket-backend');
    });

    afterAll(async () => {
        server.close();
    });

    it('should be able to create a model with API', async () => {
        const user = await ApiUser.create({
            name: 'John',
        });
        expect(user).toBeTruthy();
        expect(user).toBeInstanceOf(ApiUser);
    });

    it('should be able to update a model with API', async () => {
        const user = await ApiUser.create<ApiUser>({
            name: 'Jane',
        });
        await user.update({
            name: 'John',
        });
        expect(user.name).toBe('John');
    });

    it('should be able to delete a model without call API, and should be able to fetch a fallback model with call API', async () => {
        const user = await ApiUser.create<ApiUser>({
            name: 'John',
        });
        const id = user.id;
        await user.delete();

        const userFallback = await ApiUser.find<ApiUser>(id);
        expect(userFallback).toBeTruthy();
        expect(userFallback?._meta._fallback_api_doc).toBe(true);

        const userFallbackRefetch = await ApiUser.find<ApiUser>(id);
        expect(userFallbackRefetch).toBeTruthy();
        expect(userFallbackRefetch?._meta._fallback_api_doc).toBe(undefined);
    });

    it('should be able to fetch a fallback model with call API', async () => {
        const userFallback = await ApiUser.find<ApiUser>('api-user-test2');
        expect(userFallback).toBeTruthy();
        expect(userFallback?._meta._fallback_api_doc).toBe(true);
    });

    it('should be able to run backend function with API', async () => {
        const user = await ApiUser.create<ApiUser>({
            name: 'John',
        });
        await user.setRandomPassword();
        expect(user.password).toBeTruthy();
        expect(user.password).toBe('random');
    });

    it('should be able to call delete API manually ', async () => {
        const user = await ApiUser.create<ApiUser>({
            name: 'Test User',
        });

        const repo = ApiUser.repo();
        const apiDeleteResult = await (repo.api as ApiRepo<ApiUser>).delete(user.id);
        expect(apiDeleteResult).toBeTruthy();
    });

    it('should be able to call soft delete API', async () => {
        const user = await ApiUser.create<ApiUser>({
            name: 'Test User',
        });

        const repo = ApiUser.repo();
        const apiSoftDeleteResult = await (repo.api as ApiRepo<ApiUser>).softDelete(user.id);
        expect(apiSoftDeleteResult).toBeTruthy();
    });

    it('should be able to call resource API', async () => {
        const repo = ApiUser.repo();
        const apiResult = await (repo.api as ApiRepo<ApiUser>).callApi('GET', 'top-secret-users');
        expect(apiResult).toBeTruthy();
    });

    it('should able to fallback as undefined when api not found the non_existed_user', async () => {
        const user = await ApiUser.find<ApiUser>('non_existed_user');
        expect(user).toBeUndefined();
    });
});
