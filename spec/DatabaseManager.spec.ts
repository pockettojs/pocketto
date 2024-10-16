import { DatabaseManager, setEnvironment } from 'src/manager/DatabaseManager';
import fs from 'fs';

describe('Database Manager', () => {
    it('should be able to connect to database without define database name', async () => {
        await DatabaseManager.connect('database-manager0', { silentConnect: false, });
        expect(DatabaseManager.get()).toBeTruthy();
    });

    it('should be able to connect to database', async () => {
        await DatabaseManager.connect('database-manager', { dbName: 'database-manager', adapter: 'memory', silentConnect: true, });
        expect(DatabaseManager.get('database-manager')).toBeTruthy();
    });

    it('should throw an error if database not found', async () => {
        expect(() => DatabaseManager.get('database-manager2')).toThrowError('Database "database-manager2" not found.');
    });

    it('should be able to connect to database without adapter', async () => {
        await DatabaseManager.connect('database-manager3', { dbName: 'database-manager3', silentConnect: true, });
        expect(DatabaseManager.get('database-manager3')).toBeTruthy();
    });

    it('should throw error when Database Manager has more than one db and get without define name', async () => {
        expect(() => DatabaseManager.get()).toThrowError('There is more than one database connected. Please specify the database name to get.');
    });

    it('should throw error when Database Manager has more than one db and close without define name', async () => {
        expect(() => DatabaseManager.close()).toThrowError('There is more than one database connected. Please specify the database name to close.');
    });

    it('should be able to close database', async () => {
        await DatabaseManager.close('database-manager');
        expect(() => DatabaseManager.get('database-manager')).toThrowError('Database "database-manager" not found.');
    });

    it('should be able to close database without define database name when there is only one database', async () => {
        await DatabaseManager.close('database-manager0');
        await DatabaseManager.close('database-manager3');
        await DatabaseManager.close(); // close default database
        expect(() => DatabaseManager.get()).toThrowError('No database connected.');
    });

    it('should connect and close database with password', async () => {
        await DatabaseManager.connect('database-password', { dbName: 'database-password', adapter: 'memory', password: 'password', silentConnect: true, });
        expect(DatabaseManager.get('database-password')).toBeTruthy();
        await DatabaseManager.close();
    });

    it('should throw an error when close without connect to any database', async () => {
        expect(() => DatabaseManager.close()).toThrowError('No database connected.');
    });

    it('should be able to set runtime environment to either node or browser', () => {
        setEnvironment('node');
        expect(() => setEnvironment('browser')).toThrowError('self is not defined');
    });

    afterAll(() => {
        fs.rmSync('database-manager0', { recursive: true, force: true, });
        fs.rmSync('database-manager3', { recursive: true, force: true, });
        fs.rmSync('database-password-encrypted', { recursive: true, force: true, });
    });
});
