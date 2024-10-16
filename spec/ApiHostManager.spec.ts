import { ApiHostManager } from 'src/manager/ApiHostManager';

describe('API Host Manager', () => {
    it('should be able to add api host with removing trailing dash', async () => {
        ApiHostManager.addHost('http://pocket.test/', 'pocket-backend');
        expect(ApiHostManager.getApiInfo('pocket-backend')).toEqual({
            url: 'http://pocket.test',
        });
    });

    it('should throw error when get api info that not set', async () => {
        expect(() => ApiHostManager.getApiInfo('random-api')).toThrowError('API Host "random-api" not found');
    });

    it('should throw error when set token for api', async () => {
        expect(() => ApiHostManager.setToken('random-token', 'random-api')).toThrowError('API Host "random-api" not found');
    });

    it('should be able to set token for api', async () => {
        ApiHostManager.addHost('http://pocket.test/', 'pocket-backend');
        ApiHostManager.setToken('random-token', 'pocket-backend');
        expect(ApiHostManager.getApiInfo('pocket-backend')).toEqual({
            url: 'http://pocket.test',
            token: 'random-token',
        });
    });

    it('should be able to set token for default api', async () => {
        ApiHostManager.addHost('http://abc.com/');
        ApiHostManager.setToken('random-token');
        expect(ApiHostManager.getApiInfo()).toEqual({
            url: 'http://abc.com',
            token: 'random-token',
        });
    });
});