import uuid from 'short-uuid';
import { ValidDotNotationArray } from 'src/definitions/DotNotation';
import { EncryptedDocument } from 'src/definitions/EncryptedDocument';
import { ModelKey, ModelType, ModelValue, NewModelType } from 'src/definitions/Model';
import { RelationshipType } from 'src/definitions/RelationshipType';
import { decrypt } from 'src/encryption/encryption';
import { APIResourceInfo } from 'src/manager/ApiHostManager';
import { DatabaseCustomConfig, DatabaseManager } from 'src/manager/DatabaseManager';
import { BaseModel } from 'src/model/Model';
import { MultiQueryBuilder } from 'src/multi-database/MultiQueryBuilder';
import { convertIdFieldsToDocIds, getForeignIdFields } from 'src/relationships/RelationshipDecorator';
import { ApiRepo } from 'src/repo/ApiRepo';

const operators = ['=', '>', '>=', '<', '<=', '!=', 'in', 'not in', 'between', 'like',] as const;
export type Operator = typeof operators[number];
export type OperatorValue<T extends BaseModel, Key extends keyof T, O extends Operator> =
    O extends 'in' ? ModelValue<T, Key>[]
    : O extends 'not in' ? ModelValue<T, Key>[]
    : O extends 'between' ? [ModelValue<T, Key>, ModelValue<T, Key>]
    : O extends 'like' ? string
    : ModelValue<T, Key>;
export type QueryableModel<T extends BaseModel> = {
    [Key in ModelKey<T>]: OperatorValue<T, Key, Operator> | [Operator, OperatorValue<T, Key, Operator>];
};
export type QueryBuilderFunction<T extends BaseModel> = (query: QueryBuilder<T>) => void;

function toMangoOperator(operator: Operator): string {
    if (operator === '=') return '$eq';
    if (operator === '!=') return '$ne';
    if (operator === '>') return '$gt';
    if (operator === '>=') return '$gte';
    if (operator === '<') return '$lt';
    if (operator === '<=') return '$lte';
    if (operator === 'in') return '$in';
    if (operator === 'not in') return '$nin';
    if (operator === 'between') return '$gte';
    if (operator === 'like') return '$regex';
    return '';
}
function toMangoQuery<T extends BaseModel, Key extends ModelKey<T>, O extends Operator>(field: Key, operator: O, value: OperatorValue<T, Key, O>): PouchDB.Find.Selector {
    if (field === 'id') {
        field = '_id' as Key;
    }
    if (['=', '!=', '>', '>=', '<', '<=',].includes(operator)) {
        return { [field]: { [toMangoOperator(operator)]: value, }, };
    }
    if (['in', 'not in',].includes(operator)) {
        return { [field]: { [toMangoOperator(operator)]: value, }, };
    }
    if (operator === 'between') {
        const [fromValue, toValue,] = value as [ModelValue<T, Key>, ModelValue<T, Key>];
        return { [field]: { $gte: fromValue, $lte: toValue, }, };
    }
    if (operator === 'like') {
        return { [field]: { $regex: RegExp(value as string, 'i'), }, };
    }

    return {};
}

function idToMangoQuery<T extends BaseModel, Key extends ModelKey<T>, O extends Operator>(key: Key, operator: O, value: any, cName: string): PouchDB.Find.Selector {
    if (key === 'id') {
        key = '_id' as Key;
    }
    if (!value) return {};
    if (['=', '!=', '>', '>=', '<', '<=',].includes(operator)) {
        if (!value.includes(cName)) {
            value = `${cName}.${value}`;
        }
    }
    if (['in', 'not in',].includes(operator)) {
        value = value.map((v: string) => {
            if (!v.includes(cName)) {
                return `${cName}.${v}`;
            }
            return v;
        });
    }
    if (operator === 'between') {
        const [fromValue, toValue,] = value as [string, string];
        if (!fromValue.includes(cName)) {
            value[0] = `${cName}.${fromValue}`;
        }
        if (!toValue.includes(cName)) {
            value[1] = `${cName}.${toValue}`;
        }
    }
    if (operator === 'like') {
        value = `^${cName}.${value}`;
    }
    return toMangoQuery(key as any, operator, value);
}

function queryableValueToValue<T extends BaseModel, Key extends ModelKey<T>>(field: Key, value: ModelValue<T, Key>): PouchDB.Find.Selector {
    if (value instanceof Array && operators.includes(value[0])) {
        return toMangoQuery<T, Key, typeof value[0]>(field, value[0], value[1]);
    } else {
        return toMangoQuery<T, Key, '='>(field, '=', value);
    }
}


export function getNewId(): string {
    return String(uuid.generate());
}

export class QueryBuilder<T extends BaseModel, K extends string[] = []> {
    protected queries: PouchDB.Find.FindRequest<T> & { selector: { $and: PouchDB.Find.Selector[] } };
    protected sorters?: Array<string | { [propName: string]: 'asc' | 'desc' }>;

    protected lastWhere?: ModelKey<T> | '$or';
    protected isOne?: boolean;
    protected model: T;
    protected dbName?: string;
    protected relationships?: ValidDotNotationArray<T, K>;
    protected db: PouchDB.Database;
    protected apiInfo?: APIResourceInfo;
    public api?: ApiRepo<T>;

    protected relationshipType?: RelationshipType;
    protected localKey?: string;
    protected foreignKey?: string;

    protected softDelete?: 'with' | 'only' | 'none' = 'none';

    protected isMultiDatabase?: boolean;

    constructor(model: T, relationships?: ValidDotNotationArray<T, K>, dbName?: string, isOne?: boolean, apiInfo?: APIResourceInfo) {
        if (model.cName === undefined) {
            throw new Error('QueryBuilder create error: collectionName not found');
        }
        this.dbName = dbName;
        this.model = model;
        this.isMultiDatabase = this.model.multiDatabase;
        this.relationships = (relationships || []) as ValidDotNotationArray<T, K>;
        this.queries = { selector: { $and: [], }, };
        this.isOne = isOne;
        this.db = DatabaseManager.get(this.dbName) as PouchDB.Database<T> & DatabaseCustomConfig;
        if (!this.db) throw new Error(`Database ${this.dbName} not found`);
        this.apiInfo = apiInfo;
        if (this.apiInfo) this.api = new ApiRepo<T>(this.apiInfo);
    }

    static query<T extends BaseModel, K extends string[] = []>(model: T, relationships?: ValidDotNotationArray<T, K>, dbName?: string) {
        return new this(model, relationships, dbName, false) as QueryBuilder<T, K>;
    }

    static where<T extends BaseModel, O extends Operator>(field: ModelKey<T> | string, operator: O, value: OperatorValue<T, ModelKey<T>, O>, model: T) {
        const builder = this.query<T>(model);
        return builder.where(field as ModelKey<T>, operator, value);
    }

    raw(): PouchDB.Database {
        return this.db;
    }

    setRelationshipType(type: RelationshipType, localKey: string, foreignKey: string) {
        this.relationshipType = type;
        this.localKey = localKey;
        this.foreignKey = foreignKey;
    }
    getRelationshipType() {
        return this.relationshipType;
    }
    getLocalKey() {
        return this.localKey;
    }
    getForeignKey() {
        return this.foreignKey;
    }

    async find(id?: string, forceFind?: boolean): Promise<T | undefined> {
        if (!id) return undefined;
        const doc = await this.getDoc(id, forceFind);
        if (doc) return this.cast(doc as unknown as ModelType<T>);
        return undefined;
    }

    /**
     * Add eager loading relationships
     * @param relationships relationships to load
     * @returns QueryBuilder
     */
    with(...relationships: string[]) {
        this.relationships?.concat(relationships as ValidDotNotationArray<T, K>);
        return this;
    }

    where(condition: (query: QueryBuilder<T>) => void): this;
    where(queryableModel: Partial<QueryableModel<T>>): this;
    where<Key extends ModelKey<T>>(field: Key | string, value: OperatorValue<T, Key, '='>): this;
    where<Key extends ModelKey<T>, O extends Operator>(field: Key | string, operator: O, value: OperatorValue<T, Key, O>): this;
    where<Key extends ModelKey<T>, O extends Operator>(...args: (ModelKey<T> | Operator | OperatorValue<T, Key, O>)[]) {

        if (args.length === 2) args = [args[0], '=', args[1],];

        if (args.length === 3) {
            const [field, operator, value,] = args as [ModelKey<T>, O, OperatorValue<T, Key, O>];
            let newQuery: PouchDB.Find.Selector;
            const idFields = getForeignIdFields(this.model);
            const hasRelationship = idFields.find((f) => f.field === field);
            if (field == 'id') {
                newQuery = idToMangoQuery('id', operator, value, this.model.cName);
            } else if (hasRelationship) {
                const cName = new hasRelationship.relationship().cName;
                newQuery = idToMangoQuery(field as any, operator, value, cName);
            } else {
                newQuery = toMangoQuery(field as ModelKey<T>, operator, value);
            }
            this.queries.selector.$and.push(newQuery);
            this.lastWhere = args[0] as ModelKey<T>;
            return this;
        } else {
            if (typeof args[0] === 'object') {
                Object.entries(args[0] as object).forEach(([key, value,]) => {
                    const query = queryableValueToValue<T, Key>(key as Key, value);
                    this.queries.selector.$and.push(query);
                });
                return this;
            }
            if (typeof args[0] === 'function') {
                this.whereCondition(args[0] as QueryBuilderFunction<T>, '$and');
                return this;
            }
        }
    }

    orWhere(condition: (query: QueryBuilder<T>) => void): this;
    orWhere(queryableModel: Partial<QueryableModel<T>>): this;
    orWhere<Key extends ModelKey<T>>(field: Key | string, value: OperatorValue<T, Key, '='>): this;
    orWhere<Key extends ModelKey<T>, O extends Operator>(field: Key | string, operator: Operator, value: OperatorValue<T, Key, O>): this;
    orWhere<Key extends ModelKey<T>, O extends Operator>(...args: (ModelKey<T> | Operator | OperatorValue<T, Key, O> | ModelType<T> | QueryableModel<T>)[]) {
        if (args.length === 2) args = [args[0], '=', args[1],];

        const queries = this.queries.selector.$and;
        const lastQueryIndex = queries.length - 1;
        const lastQuery = queries[lastQueryIndex];
        this.queries.selector.$and = this.queries.selector.$and.filter((_, i) => i !== lastQueryIndex);

        if (args.length === 3) {
            const [field, operator, value,] = args as [ModelKey<T>, O, OperatorValue<T, Key, O>];
            let newQuery: PouchDB.Find.Selector;
            const idFields = getForeignIdFields(this.model);
            const hasRelationship = idFields.find((f) => f.field === field);
            if (field == 'id') {
                newQuery = idToMangoQuery('id', operator, value, this.model.cName);
            } else if (hasRelationship) {
                const cName = new hasRelationship.relationship().cName;
                newQuery = idToMangoQuery(field as any, operator, value, cName);
            } else {
                newQuery = toMangoQuery(field as ModelKey<T>, operator, value);
            }
            if (this.lastWhere === '$or') {
                if (!lastQuery.$or) lastQuery.$or = [];
                lastQuery.$or.push(newQuery);
                this.queries.selector.$and.push(lastQuery);
            } else {
                if (!lastQuery) {
                    this.queries.selector.$and.push({ $or: [newQuery,], });
                } else {
                    this.queries.selector.$and.push({ $or: [lastQuery, newQuery,], });
                }
            }
            this.lastWhere = '$or';
            return this;
        } else {
            if (typeof args[0] === 'object') {
                Object.entries(args[0] as object).forEach(([key, value,]) => {
                    let operator: Operator, objectValue: OperatorValue<T, ModelKey<T>, Operator>;
                    if (value instanceof Array && operators.includes(value[0])) {
                        operator = value[0];
                        objectValue = value[1];
                    } else {
                        operator = '=';
                        objectValue = value;
                    }
                    this.orWhere(key as ModelKey<T>, operator, objectValue);
                });
                return this;
            }
            if (typeof args[0] === 'function') {
                this.whereCondition(args[0] as QueryBuilderFunction<T>, '$or');
                return this;
            }
        }
    }

    whereCondition(condition: QueryBuilderFunction<T> | Partial<ModelType<T>>, type: '$and' | '$or'): this {
        if (typeof condition === 'function') {
            const newQueryBuilder = new QueryBuilder<T, []>(this.model, [] as ValidDotNotationArray<T, []>, this.dbName);
            (condition as QueryBuilderFunction<T>)(newQueryBuilder);
            this.queries.selector.$and = this.queries.selector.$and.concat(newQueryBuilder.queries.selector.$and || []);
        } else if (typeof condition === 'object') {
            Object.entries(condition).forEach(([key, value,]) => {
                let operator: Operator, objectValue: OperatorValue<T, ModelKey<T>, Operator>;
                if (value instanceof Array && operators.includes(value[0])) {
                    operator = value[0];
                    objectValue = value[1];
                } else {
                    operator = '=';
                    objectValue = value;
                }

                if (type == '$and') {
                    this.where(key as ModelKey<T>, operator, objectValue);
                } else {
                    this.orWhere(key as ModelKey<T>, operator, objectValue);
                }
                this.lastWhere = key as ModelKey<T>;
            });
        }
        return this;
    }

    withTrashed() {
        this.softDelete = 'with';
        return this;
    }

    onlyTrashed() {
        this.softDelete = 'only';
        return this;
    }
    withoutTrashed() {
        this.softDelete = 'none';
        return this;
    }


    orderBy(field: keyof T, order: 'asc' | 'desc' = 'asc') {
        if (!this.sorters) {
            this.sorters = [];
        }
        this.sorters.push({ [field]: order, });
        return this;
    }

    paginate(page: number, limit: number) {
        this.queries.limit = limit;
        this.queries.skip = (page - 1) * limit;
        return this;
    }

    getQuery() {
        return this.queries;
    }

    getRelationships() {
        return this.relationships;
    }

    private sort(data: T[]) {
        if (this.sorters) {
            for (const sort of this.sorters) {
                const [key, order,] = Object.entries(sort)[0];
                if (!key.includes('.')) {
                    data.sort((a, b) => {
                        if (a[key as ModelKey<T>] > b[key as ModelKey<T>]) {
                            return order === 'asc' ? 1 : -1;
                        }
                        if (a[key as ModelKey<T>] < b[key as ModelKey<T>]) {
                            return order === 'asc' ? -1 : 1;
                        }
                        return 0;
                    });
                } else {
                    const mainKey = key.split('.')[0];
                    const subKey = key.split('.').slice(1).join('.');
                    data.sort((a, b) => {
                        if (a[mainKey as keyof T][subKey as keyof T[keyof T]] > b[mainKey as keyof T][subKey as keyof T[keyof T]]) {
                            return order === 'asc' ? 1 : -1;
                        }
                        if (a[mainKey as keyof T][subKey as keyof T[keyof T]] < b[mainKey as keyof T][subKey as keyof T[keyof T]]) {
                            return order === 'asc' ? -1 : 1;
                        }
                        return 0;
                    });
                }
            }
        }
        return data;
    }

    private async bindRelationship(model: T) {
        if (!model.relationships) model.relationships = {};
        model.bindRelationships();
        if (this.relationships && model.relationships) {
            for (const r of this.relationships) {
                try {
                    if (r.includes('.')) {
                        const mainRelationship = r.split('.')[0];
                        const subRelationships = r.split('.').slice(1).join('.');
                        const mainModel = model[mainRelationship as keyof T] as BaseModel | BaseModel[];
                        if (mainModel && mainModel instanceof BaseModel) {
                            const newMainModel = await new QueryBuilder(mainModel, [subRelationships,], this.dbName)
                                .orderBy('createdAt', 'asc')
                                .bindRelationship(mainModel);
                            model[mainRelationship as keyof T] = newMainModel as ModelValue<T, keyof T>;
                        } else if (mainModel && mainModel instanceof Array) {
                            const newMainModels = await Promise.all(mainModel.map(async (m) => await new QueryBuilder(m, [subRelationships,], this.dbName)
                                .orderBy('createdAt', 'asc')
                                .bindRelationship(m)));
                            model[mainRelationship as keyof T] = newMainModels as ModelValue<T, keyof T>;
                        }
                    } else {
                        const queryBuilder = await model.relationships[r as string]() as QueryBuilder<T>;
                        queryBuilder.orderBy('createdAt', 'asc');
                        if (queryBuilder.isOne) {
                            Object.assign(model, { [r]: await queryBuilder.first(), });
                        } else {
                            Object.assign(model, { [r]: await queryBuilder.get(), });
                        }
                    }
                } catch (error) {
                    throw new Error(`Relationship "${r as string}" does not exists in model ${model.getClass().name}`);
                }
            }
        }
        return model;
    }

    protected async cast(item?: ModelType<T>): Promise<T | undefined> {
        if (!item) return;
        let model;
        const klass = this.model.getClass();
        if ((item as ModelType<T> & { _id: string })._id) {
            item.id = (item as ModelType<T> & { _id: string })._id;
            delete (item as ModelType<T> & { _id?: string })._id;
        }
        model = new klass(item) as T;
        model._meta._dirty = {};
        model._meta._before_dirty = {};
        if (model._tempPeriod) {
            model._meta._period = model._tempPeriod;
            delete model._tempPeriod;
        }
        model = await this.bindRelationship(model);
        model.setForeignFieldsToModelId();
        return model;
    }

    private getComparisonValue(item: T, key: string): string {
        if (key.includes('.')) {
            return this.getComparisonValue(item[key.split('.')[0] as keyof T] as unknown as T, key.split('.').slice(1).join('.'));
        }
        return item[key as keyof T] as unknown as string;
    }

    private checkOrTargetDoc(item: T, selectors: PouchDB.Find.Selector[]): boolean {
        let isTargetDoc = false;

        for (const selector of selectors) {
            const key = Object.keys(selector)[0];
            let comparisonValue;
            if (key.includes('.')) {
                comparisonValue = this.getComparisonValue(item, key);
            } else {
                comparisonValue = item[key as keyof T];
            }

            const value = selector[key];
            const operator = Object.keys(value)[0];
            const operatorValue = value[operator];
            if (operator === '$eq') {
                isTargetDoc = comparisonValue === operatorValue;
            } else if (operator === '$ne') {
                isTargetDoc = comparisonValue !== operatorValue;
            } else if (operator === '$gt') {
                isTargetDoc = comparisonValue > operatorValue;
            } else if (operator === '$lt') {
                isTargetDoc = comparisonValue < operatorValue;
            } else if (operator === '$gte') {
                isTargetDoc = comparisonValue >= operatorValue;
            } else if (operator === '$lte') {
                isTargetDoc = comparisonValue <= operatorValue;
            } else if (operator === '$in') {
                isTargetDoc = (operatorValue as any[]).includes(comparisonValue);
            } else if (operator === '$nin') {
                isTargetDoc = !(operatorValue as any[]).includes(comparisonValue);
            } else if (operator === '$regex' && comparisonValue) {
                isTargetDoc = (comparisonValue as string).match(operatorValue as string) !== null;
            } else if (Array.isArray(operatorValue)) {
                return this.checkIfTargetDoc(item);
            }
            if (isTargetDoc) return true;
        }
        return isTargetDoc;
    }

    private checkIfTargetDoc(item: T): boolean {
        let isTargetDoc = false;
        for (const selector of this.queries.selector.$and) {
            if (selector.$or) {
                return this.checkOrTargetDoc(item, selector.$or);
            }

            const key = Object.keys(selector)[0];
            let comparisonValue;
            if (key.includes('.')) {
                comparisonValue = this.getComparisonValue(item, key);
            } else {
                comparisonValue = item[key as keyof T];
            }

            const value = selector[key];
            const operator = Object.keys(value)[0];
            const operatorValue = value[operator];
            if (operator === '$eq') {
                isTargetDoc = comparisonValue === operatorValue;
            } else if (operator === '$ne') {
                isTargetDoc = comparisonValue !== operatorValue;
            } else if (operator === '$gt') {
                isTargetDoc = comparisonValue > operatorValue;
            } else if (operator === '$lt') {
                isTargetDoc = comparisonValue < operatorValue;
            } else if (operator === '$gte') {
                isTargetDoc = comparisonValue >= operatorValue;
            } else if (operator === '$lte') {
                isTargetDoc = comparisonValue <= operatorValue;
            } else if (operator === '$in') {
                isTargetDoc = (operatorValue as any[]).includes(comparisonValue);
            } else if (operator === '$nin') {
                isTargetDoc = !(operatorValue as any[]).includes(comparisonValue);
            } else if (operator === '$regex' && comparisonValue) {
                isTargetDoc = (comparisonValue as string).match(operatorValue as string) !== null;
            } else if (Array.isArray(operatorValue)) {
                return this.checkIfTargetDoc(item);
            }
            if (!isTargetDoc) return false;
        }
        return isTargetDoc;
    }

    private async jsSearch(): Promise<T[]> {
        const result = await this.db.find({
            selector: {
                _id: { $regex: `^${this.model.cName}`, },
            },
            limit: 99999,
        });
        result.docs = result.docs.map((doc) => {
            const item = doc as unknown as EncryptedDocument;
            if (!item.payload) return item;
            const decryptedItem = decrypt(item.payload, this.dbName || 'default');

            const decryptedDoc = {
                _id: item._id,
                _rev: item._rev,
                ...decryptedItem,
            };
            return decryptedDoc;
        });

        result.docs = result.docs.filter((doc) => {
            const item = doc as unknown as T;
            let isTargetDoc = false;
            if (this.softDelete === 'none') {
                isTargetDoc = !item.deletedAt;
            } else if (this.softDelete === 'only') {
                isTargetDoc = !!item.deletedAt;
            }
            isTargetDoc = this.checkIfTargetDoc(item);
            return isTargetDoc;
        });
        return result.docs as PouchDB.Core.ExistingDocument<T>[];
    }

    private async mangoQuery(db: PouchDB.Database<T> & DatabaseCustomConfig) {
        this.queries.limit = 99999;
        const result = await db.find(this.queries) as PouchDB.Find.FindResponse<{}>;
        return result.docs;
    }

    setQueries(queries: PouchDB.Find.FindRequest<{}> & { selector: { $and: PouchDB.Find.Selector[] } }) {
        this.queries = queries;
        return this;
    }

    setIsMultiDatabase(isMultiDatabase: boolean) {
        this.isMultiDatabase = isMultiDatabase;
        return this;
    }

    protected period?: string;
    setPeriod(period?: string) {
        this.period = period;
        return this;
    }

    async get(): Promise<T[]> {
        this.queries.selector.$and.push({
            _id: { $regex: `^${this.model.cName}`, },
        });
        if (this.softDelete === 'none') {
            this.where('deletedAt', '=', undefined as any);
            this.queries.selector.$and.push({
                deletedAt: { $exists: false, },
            });
        } else if (this.softDelete === 'only') {
            this.where('deletedAt', '!=', undefined as any);
            this.queries.selector.$and.push({
                deletedAt: { $exists: true, },
            });
        }

        if (this.isMultiDatabase) {
            const multiQb = new MultiQueryBuilder(this.model, this.relationships);
            multiQb.setQueryBuilder(this);
            return multiQb.get();
        }

        const db = DatabaseManager.get(this.dbName) as PouchDB.Database<T> & DatabaseCustomConfig;
        if (!db) {
            throw new Error(`Database ${this.dbName} not found`);
        }
        let data;
        if (db.hasPassword) {
            data = await this.jsSearch();
        } else {
            data = await this.mangoQuery(db);
        }
        const sortedData = this.sort(data as any);
        data = sortedData as (T & { _id: string, _rev: string })[];
        const result = [] as T[];
        for (const item of data) {
            const model = await this.cast(item as unknown as ModelType<T>);
            if (this.period && model?._meta) {
                model._meta._period = this.period;
            }
            if (model) result.push(model);
        }
        return result;
    }

    async first(): Promise<T | undefined> {
        this.isOne = true;
        const result = await this.get();
        return result[0];
    }

    async last(): Promise<T | undefined> {
        this.isOne = true;
        const result = await this.get();
        return result[result.length - 1];
    }

    async count() {
        return (await this.get()).length;
    }

    async getDoc(id?: string, forceFind?: boolean): Promise<PouchDB.Core.IdMeta & PouchDB.Core.GetMeta | undefined> {
        if (!id) return undefined;
        if (!id.includes(this.model.cName + '.')) id = this.model.cName + '.' + id;
        try {
            const result = await this.db.get(id) as PouchDB.Core.IdMeta & PouchDB.Core.GetMeta & { id: string };
            result.id = result._id;
            delete (result as Partial<PouchDB.Core.IdMeta>)._id;
            if (this.softDelete === 'none' && (result as any).deletedAt !== undefined && !forceFind) {
                return undefined;
            }
            return result;
        } catch (e) {
            if (this.apiInfo && this.apiInfo.apiFallbackGet) {
                const result = await this.api?.get(id);
                if (!result) return undefined;
                delete (result as any)._rev;
                if (id.includes(this.model.cName)) {
                    id = id.replace(`${this.model.cName}.`, '');
                }
                const createdItem = await this.create({ ...result, id, } as NewModelType<T>, true);
                result._meta = {} as any;
                result._meta._fallback_api_doc = true;
                result._meta._rev = createdItem.rev;
                result.id = createdItem.id;
                delete (result as Partial<PouchDB.Core.IdMeta>)._id;
                delete (result as Partial<PouchDB.Core.GetMeta>)._rev;
                return result as unknown as PouchDB.Core.IdMeta & PouchDB.Core.GetMeta & { id: string };
            }
            return undefined;
        }
    }

    async create(attributes: NewModelType<T>, fallbackCreate = false): Promise<PouchDB.Core.Response> {
        if (!attributes.id) {
            attributes.id = getNewId();
        }
        if (!attributes.id.includes(this.model.cName)) {
            attributes.id = `${this.model.cName}.${attributes.id}`;
        }
        const newAttr = {} as NewModelType<T>;
        for (const key in attributes) {
            if (typeof attributes[key as keyof NewModelType<T>] === 'function') {
                newAttr[key as keyof NewModelType<T>] = (attributes[key as keyof NewModelType<T>] as Function).toString() as any;
            }
        }
        const attr = { ...attributes, ...newAttr, } as NewModelType<T> & { _id?: string, };
        attr._id = attr.id as string;
        delete attr.id;
        const result = await this.db.post(attr);
        if (this.apiInfo && this.apiInfo.apiAutoCreate && !fallbackCreate) {
            await this.api?.create(attributes);
        }
        return result;
    }

    async update(attributes: Partial<ModelType<T>>): Promise<PouchDB.Core.Response> {
        const doc = await this.find(attributes.id as string);
        if (!doc) return { ok: false, } as PouchDB.Core.Response;
        const newAttr = {} as NewModelType<T>;
        for (const key in attributes) {
            if (typeof attributes[key as keyof NewModelType<T>] === 'function') {
                newAttr[key as keyof NewModelType<T>] = (attributes[key as keyof NewModelType<T>] as Function).toString() as any;
            }
        }
        let attr = { ...doc.toJson(), ...attributes, ...newAttr, } as Partial<T> & { _id?: string, _rev?: string, };
        attr._id = attr.id as string;
        if (!doc._meta._rev) throw new Error('Document revision not found');
        attr._rev = doc._meta._rev;
        delete attr.id;
        attr = convertIdFieldsToDocIds(attr, this.model);
        for (const key in newAttr) {
            if (newAttr[key as keyof NewModelType<T>] === undefined || newAttr[key as keyof NewModelType<T>] === null) {
                delete attr[key as keyof NewModelType<T>];
            }
        }
        const result = await this.db.put(attr, {
            force: false,
        });
        if (this.apiInfo && this.apiInfo.apiAutoUpdate) {
            await this.api?.update(attr);
        }
        return result;
    }

    async delete() {
        const getResult = await this.get();
        const idDeleteResult: { [id: string]: boolean } = {};
        await Promise.all(getResult.map(async (item) => {
            try {
                idDeleteResult[item.id as string] = true;
                await item.delete();
            } catch (error) {
                idDeleteResult[item.id as string] = false;
            }
        }));
        return idDeleteResult;
    }

    async deleteOne(id: string) {
        const doc = await this.find(id, true);
        if (!doc) {
            return Promise.reject(new Error('Document not found'));
        }
        const rawDoc = doc.toJson() as T & { _id?: string, _rev?: string, };
        rawDoc._id = this.model.cName + '.' + id;
        rawDoc._rev = doc._meta._rev;
        const result = await this.db.remove(rawDoc as PouchDB.Core.RemoveDocument);
        if (this.apiInfo && this.apiInfo.apiAutoDelete) {
            await this.api?.delete(id);
        }
        if (this.apiInfo && this.apiInfo.apiAutoSoftDelete) {
            await this.api?.softDelete(id);
        }
        return result;
    }

    async createIndex(index: PouchDB.Find.CreateIndexOptions) {
        return this.db.createIndex(index);
    }
}