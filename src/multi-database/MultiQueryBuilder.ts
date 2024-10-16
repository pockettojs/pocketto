import { ValidDotNotationArray } from 'src/definitions/DotNotation';
import { BaseModel, Operator, OperatorValue, QueryableModel, QueryBuilder } from '..';
import { getMainDatabaseName } from './MutliDatabaseConfig';
import { ModelKey, NewModelType } from 'src/definitions/Model';
import MultipleDatabase from './MultiDatabase';
import moment from 'moment';

export class MultiQueryBuilder<T extends BaseModel, K extends string[] = []> {
    protected model: T;
    protected queryBuilder: QueryBuilder<T, K>;

    setQueryBuilder(queryBuilder: QueryBuilder<T, K>) {
        this.queryBuilder = queryBuilder;
    }

    constructor(model: T, relationships?: ValidDotNotationArray<T, K>) {
        this.model = model;
        const mainDbName = getMainDatabaseName();
        if (!model.multiDatabase) throw new Error(`Model ${model.cName} is not multi database enabled`);
        this.queryBuilder = QueryBuilder.query(model, relationships, mainDbName);
    }

    static query<T extends BaseModel, K extends string[] = []>(model: T, relationships?: ValidDotNotationArray<T, K>) {
        return new this(model, relationships);
    }

    static where<T extends BaseModel, O extends Operator>(field: ModelKey<T> | string, operator: O, value: OperatorValue<T, ModelKey<T>, O>, model: T) {
        const builder = this.query<T>(model);
        builder.where(field as ModelKey<T>, operator, value);
        return this;
    }

    async with(...relationships: string[]) {
        this.queryBuilder.with(...relationships);
        return this;
    }

    where(condition: (query: QueryBuilder<T>) => void): this;
    where(queryableModel: Partial<QueryableModel<T>>): this;
    where<Key extends ModelKey<T>>(field: Key | string, value: OperatorValue<T, Key, '='>): this;
    where<Key extends ModelKey<T>, O extends Operator>(field: Key | string, operator: O, value: OperatorValue<T, Key, O>): this;
    where<Key extends ModelKey<T>, O extends Operator>(...args: (ModelKey<T> | Operator | OperatorValue<T, Key, O>)[]) {
        this.queryBuilder.where(args[0] as ModelKey<T>, args[1] as Operator, args[2] as OperatorValue<T, Key, O> | any);
        return this;
    }

    orWhere(condition: (query: QueryBuilder<T>) => void): this;
    orWhere(queryableModel: Partial<QueryableModel<T>>): this;
    orWhere<Key extends ModelKey<T>>(field: Key | string, value: OperatorValue<T, Key, '='>): this;
    orWhere<Key extends ModelKey<T>, O extends Operator>(field: Key | string, operator: O, value: OperatorValue<T, Key, O>): this;
    orWhere<Key extends ModelKey<T>, O extends Operator>(...args: (ModelKey<T> | Operator | OperatorValue<T, Key, O>)[]) {
        this.queryBuilder.orWhere(args[0] as ModelKey<T>, args[1] as Operator, args[2] as OperatorValue<T, Key, O> | any);
        return this;
    }

    withTrashed() {
        this.queryBuilder.withTrashed();
        return this;
    }

    onlyTrashed() {
        this.queryBuilder.onlyTrashed();
        return this;
    }

    withoutTrashed() {
        this.queryBuilder.withoutTrashed();
        return this;
    }

    orderBy(field: keyof T, order: 'asc' | 'desc' = 'asc') {
        this.queryBuilder.orderBy(field, order);
        return this;
    }

    protected paginateLimit?: number;
    protected paginateSkip?: number;
    paginate(page: number, limit: number) {
        this.paginateLimit = limit;
        this.paginateSkip = (page - 1) * limit;
        return this;
    }

    getQuery() {
        return this.queryBuilder.getQuery();
    }

    private async getDbs() {
        const transactionDatabases = MultipleDatabase.databases;
        return transactionDatabases;
    }

    private async getDbsName() {
        const dbs = await this.getDbs();
        return dbs.map(db => db.config.dbName);
    }

    async get() {
        const dbs = await this.getDbs();
        const dbNames = await this.getDbsName();
        const query = this.getQuery();


        // handle pagination
        if (typeof this.paginateLimit === 'number' && typeof this.paginateSkip === 'number') {
            const countResults = await Promise.all(dbNames.map(db => QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db).setIsMultiDatabase(false).setQueries(query).count()));

            let skip = this.paginateSkip;
            let limit = this.paginateLimit;

            const results = await Promise.all(dbs.map(async db => {
                const count = countResults.shift() as number;
                if (skip >= count) {
                    skip -= count;
                    return [];
                }
                const result = await QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db!.config!.dbName).setPeriod(db!.period).setIsMultiDatabase(false).setQueries(query).paginate(skip, limit).get();
                limit -= result.length;
                skip = 0;
                return result;
            }));

            return results.flat();
        }

        const results = await Promise.all(dbs.map(async (db) => {
            const result = await QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db!.config!.dbName).setPeriod(db!.period).setIsMultiDatabase(false).setQueries(query).get();
            return result;
        }));
        return results.flat();
    }

    async first() {
        const result = await this.get();
        return result[0];
    }

    async last() {
        const result = await this.get();
        return result[result.length - 1];
    }

    async count() {
        const dbs = await this.getDbsName();
        const query = this.getQuery();
        const counts = await Promise.all(dbs.map(db => QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db).setIsMultiDatabase(false).setQueries(query).count()));
        return counts.reduce((acc, count) => acc + count, 0);
    }

    async getDoc(id?: string, forceFind?: boolean): Promise<PouchDB.Core.IdMeta & PouchDB.Core.GetMeta | undefined> {
        const dbs = await this.getDbsName();
        const query = this.getQuery();
        const results = await Promise.all(dbs.map(db => {
            const result = QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db).setIsMultiDatabase(false).setQueries(query).get();
            return result.then(docs => {
                const found = docs.find(doc => doc.id === id);
                if (found) return db;
                return undefined;
            });
        }));
        const foundDatabase = results.find(db => db !== undefined);
        const doc = QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), foundDatabase).setQueries(query).getDoc(id, forceFind);
        return doc;
    }

    async create(attributes: NewModelType<T>, currentPeriod = moment().format('YYYY-MM'), fallbackCreate = false): Promise<PouchDB.Core.Response> {
        const dbs = await this.getDbs();
        let db = dbs.find(db => db.period === currentPeriod);
        if (!db) {
            db = await MultipleDatabase.createDatabase(currentPeriod);
        }
        return QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db.config.dbName).create(attributes, fallbackCreate);
    }

    async update(attributes: Partial<T>, period?: string): Promise<PouchDB.Core.Response> {
        const dbs = await this.getDbsName();

        if (period) {
            const db = dbs.find(db => db === `${getMainDatabaseName()}-${period}`);
            const qb = QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db);
            if (db) {
                const model = await qb.find(attributes.id);
                if (model) {
                    const updateResponse = await qb.update(attributes);
                    model._meta._rev = updateResponse.rev;
                    return model as any as PouchDB.Core.Response;
                }
            }
        } else {
            const resultArray = await Promise.all(dbs.map(async db => {
                const qb = QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db);
                const model = await qb.find(attributes.id);
                if (model) {
                    const updateResponse = await qb.update(attributes);
                    model._meta._rev = updateResponse.rev;
                    return model as any as PouchDB.Core.Response;
                }
                return null;
            }));
            return resultArray.find(result => result !== null) as PouchDB.Core.Response;
        }
        return null as any as PouchDB.Core.Response;
    }

    async delete() {
        const dbs = await this.getDbs();
        await Promise.all(dbs.map(db => QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db.name).delete()));
    }

    async deleteOne(id: string) {
        const dbs = await this.getDbsName();
        await Promise.all(dbs.map(db => QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db).deleteOne(id)));
    }

    async find(id: string, forceFind = false): Promise<T | undefined> {
        const dbs = await this.getDbsName();
        const results = await Promise.all(dbs.map(db => QueryBuilder.query(this.model, this.queryBuilder.getRelationships(), db).find(id, forceFind)));
        return results.find(result => result !== undefined);
    }

    async createIndex(index: PouchDB.Find.CreateIndexOptions) {
        const dbs = await this.getDbsName();
        await Promise.all(dbs.map(db => QueryBuilder.query(this.model, [], db).createIndex(index)));
    }
}