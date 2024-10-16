import { DatabaseManager } from 'src/manager/DatabaseManager';
import { Model } from 'src/model/Model';
import { setMainDatabaseName } from 'src/multi-database/MutliDatabaseConfig';

describe('Model Multi Database', () => {
    class Invoice extends Model {
        static dbName = 'model-multi-database';
        static multiDatabase = true;
        static softDelete = false;

        total!: number;
    }

    beforeEach(async () => {
        await DatabaseManager.connect('model-multi-database', { dbName: 'model-multi-database', adapter: 'memory', silentConnect: true, });
        setMainDatabaseName('model-multi-database');
    });

    it('should be able to create and find a new model', async () => {
        const invoice = await Invoice.create({
            total: 100,
        });
        expect(invoice).toBeTruthy();
        const savedInvoice = await Invoice.find(invoice.id);
        expect(savedInvoice).toBeTruthy();
    });

    it('should be able to create a new model in a different database', async () => {
        const invoice = await Invoice.create({
            total: 100,
        }, '2021-01');
        const savedInvoice = await Invoice.find(invoice.id);
        expect(savedInvoice).toBeTruthy();
    });

    it('should be able to query the models in different database', async () => {
        await Invoice.create({
            total: 200,
        }, '2021-01');
        await Invoice.create({
            total: 200,
        }, '2021-02');
        const savedInvoices = await Invoice.query().where('total', 200).get();
        expect(savedInvoices.length).toBe(2);
    });

    it('should be able to update the models in different database', async () => {
        await Invoice.create({
            total: 300,
        }, '2021-01');
        await Invoice.create({
            total: 300,
        }, '2021-02');
        const savedInvoices = await Invoice.query().where('total', 200).get();
        await Promise.all(savedInvoices.map(invoice => invoice.update({ total: 400, })));

        const updatedInvoices = await Invoice.query().where('total', 400).get();
        expect(updatedInvoices.length).toBe(2);
    });

    it('should be able to delete the models in different database', async () => {
        await Invoice.create({
            total: 500,
        }, '2021-01');
        await Invoice.create({
            total: 500,
        }, '2021-02');
        const savedInvoices = await Invoice.query().where('total', 500).get();
        await Promise.all(savedInvoices.map(invoice => invoice.delete()));

        const deletedInvoices = await Invoice.query().where('total', 500).get();
        expect(deletedInvoices.length).toBe(0);
    });
});