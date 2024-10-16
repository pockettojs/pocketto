import { QueryBuilder, Operator, OperatorValue, QueryableModel } from 'src/query-builder/QueryBuilder';
import { RepoManager } from 'src/manager/RepoManager';

import { belongsTo } from 'src/relationships/BelongsTo';
import { hasOne } from 'src/relationships/HasOne';
import { hasMany } from 'src/relationships/HasMany';
import { belongsToMany } from 'src/relationships/BelongsToMany';

import moment from 'moment';
import pluralize from 'pluralize';
import { ModelKey, ModelStatic, ModelType, ModelValue, NewModelType } from 'src/definitions/Model';
import { APIAutoConfig } from 'src/definitions/APIAutoConfig';
import { needToReload } from 'src/real-time/RealTimeModel';
import { APIMethod } from 'src/repo/ApiRepo';
import { ValidDotNotationArray } from 'src/definitions/DotNotation';
import { RelationshipType } from 'src/definitions/RelationshipType';
import { DatabaseManager, convertIdFieldsToDocIds, convertIdFieldsToModelIds, getRelationships } from '..';
import { getModelClass } from './ModelDecorator';
import { MultiQueryBuilder } from 'src/multi-database/MultiQueryBuilder';
import MultipleDatabase from 'src/multi-database/MultiDatabase';
import { getMainDatabaseName } from 'src/multi-database/MutliDatabaseConfig';

export function setDefaultDbName(dbName: string): string {
    BaseModel.dbName = dbName;
    return BaseModel.dbName;
}
export function setDefaultNeedTimestamp(timestamp: boolean): boolean {
    BaseModel.timestamp = timestamp;
    return BaseModel.timestamp;
}

export function setDefaultNeedSoftDelete(softDelete: boolean): boolean {
    BaseModel.softDelete = softDelete;
    return BaseModel.softDelete;
}

export class BaseModel {
    static collectionName?: string;
    static dbName: string = 'default';
    static readonlyFields: string[] = [];
    static timestamp?: boolean = true;
    static softDelete: boolean = true;
    static multiDatabase: boolean = false;

    getClass(): typeof BaseModel {
        return this.constructor as typeof BaseModel;
    }

    public get cName() {
        return this.getClass().collectionName || pluralize(this.getClass().name, 2);
    }
    public get dName() {
        return this.getClass().dbName;
    }
    public get multiDatabase() {
        return this.getClass().multiDatabase;
    }
    public get needTimestamp() {
        let timestamp = this.getClass().timestamp;
        if (!timestamp) {
            timestamp = true;
        }
        return timestamp;
    }
    public get needSoftDelete() {
        let softDelete = this.getClass().softDelete;
        if (!softDelete) {
            softDelete = true;
        }
        return softDelete;
    }

    // start of API feature
    static apiName?: string;
    static apiResource?: string;
    static apiAuto?: APIAutoConfig;

    public get aName() {
        return this.getClass().apiName;
    }
    public get aResource() {
        return this.getClass().apiResource;
    }
    public get aAuto() {
        return this.getClass().apiAuto;
    }
    public get docId() {
        return this.id?.includes(this.cName + '.') ? this.id : this.cName + '.' + this.id;
    }
    public get modelId() {
        return this.id?.includes(this.cName + '.') ? this.id.replace(this.cName + '.', '') : this.id;
    }
    // end of API feature

    relationships!: { [relationshipName: string]: () => QueryBuilder<any> };
    public id: string = '';
    public _meta!: {
        _id: string;
        _fallback_api_doc: boolean;
        _dirty: { [key: string]: boolean };
        _before_dirty: { [key: string]: any };
        _update_callbacks?: Function[];
        _rev: string;

        _period?: string;
    };
    public _tempPeriod?: string;
    public createdAt?: string;
    public updatedAt?: string;
    public deletedAt?: string;

    // start of object construction
    public fill(attributes: Partial<ModelType<this>>): void {
        if (attributes.id) attributes.id = attributes.id.replace(this.cName + '.', '');
        if (attributes._meta?._before_dirty) delete (attributes as any)._meta._before_dirty;
        if (attributes._meta?._dirty) delete (attributes as any)._meta._dirty;

        // convert function string to function
        for (const key in attributes) {
            // @ts-ignore
            if (typeof attributes[key as keyof ModelType<this>] === 'string' && attributes[key as keyof ModelType<this>]?.includes('=>')) {
                const funcString = attributes[key as keyof ModelType<this>] as string;
                const func = new Function('return ' + funcString)();
                attributes[key as keyof ModelType<this>] = func;
            }
        }

        Object.assign(this, attributes);
        if (!this._meta) this._meta = {} as this['_meta'];
        if (!this._meta._dirty) this._meta._dirty = {};
        if (!this._meta._before_dirty) this._meta._before_dirty = {};
        this._meta._rev = (this as any)._rev;
        delete (this as any)._rev;
        for (const key of Object.keys(attributes)) {
            this._meta._before_dirty[key] = this[key as keyof this];
            this._meta._dirty[key] = true;
        }
        if (!this.relationships) this.relationships = {};
        this.bindRelationships();
    }
    constructor(attributes?: any) {
        if (!this._meta) this._meta = {} as this['_meta'];
        if (attributes) this.fill(attributes as unknown as ModelType<this>);
        if (attributes && attributes._rev) {
            this._meta._rev = attributes._rev;
            delete attributes._rev;
        }
        const handler = {
            set: <Key extends ModelKey<this>>(target: this, key: Key, value: ModelValue<this, Key>) => {
                if (value === undefined && attributes && Object.keys(attributes).includes(key as string) && target._meta._before_dirty[key as string] === undefined) {
                    value = attributes[key as keyof ModelType<this>];
                }
                // prevent update reserved fields
                // const RESERVED_FIELDS = ['id', 'createdAt', 'updatedAt', 'relationships', '_dirty'];
                // if (RESERVED_FIELDS.includes(key) && target[key]) {
                //     throw new Error(`Cannot update reserved field ${key}`);
                // }

                if (!target._meta) target._meta = {} as this['_meta'];
                if (!target._meta._dirty) target._meta._dirty = {};
                if (!target._meta._before_dirty) target._meta._before_dirty = {};


                if (key === '_meta' || key === 'relationships') {
                    target[key] = value;
                    return true;
                }
                if (target[key as ModelKey<this>] && target._meta._before_dirty[key as string] === undefined) {
                    target._meta._before_dirty[key as string] = target[key as ModelKey<this>];
                }
                try {
                    target[key] = value;
                    target._meta._dirty[key as string] = true;
                } catch (e) {
                    // try fix that the target[key] might only have getter
                    return true;
                }

                return true;
            },
        };
        return new Proxy(this, handler as ProxyHandler<this>);
    }
    public replicate(): this {
        const replicatedModel = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        delete replicatedModel.id;
        delete replicatedModel._meta._rev;
        return replicatedModel;
    }
    // end of object construction

    // start of foreign key handling
    public setForeignFieldsToDocId(): this {
        const meta = { ...this._meta, };
        const result = convertIdFieldsToDocIds(this, this);
        this.fill(result);
        meta._dirty = {};
        meta._before_dirty = {};
        this._meta = meta;
        return this;
    }
    public setForeignFieldsToModelId(): this {
        const meta = { ...this._meta, };
        const result = convertIdFieldsToModelIds(this, this);
        this.fill(result);
        meta._dirty = {};
        meta._before_dirty = {};
        this._meta = meta;
        return this;
    }
    // end of foreign key handling

    // start of CRUD operation
    /**
     * @deprecated retuen query builder of the model
     * @returns A query builder of that model
     */
    static repo<T extends BaseModel>(this: ModelStatic<T>): QueryBuilder<T> {
        return RepoManager.get(new this()) as QueryBuilder<T>;
    }
    /**
     * Get the first model in the collection
     * @returns a model or undefined
     */
    static first<T extends BaseModel>(this: ModelStatic<T>): Promise<T | undefined> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).first();
    }
    /**
     * Count all models
     * @returns number of models
     */
    static count<T extends BaseModel>(this: ModelStatic<T>): Promise<number> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).count();
    }
    /**
     * Get all models
     * @returns an array of models
     */
    static async all<T extends BaseModel>(this: ModelStatic<T>): Promise<T[]> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).get();
    }

    /**
     * Find a model by primary key
     * @param primaryKey id of the model
     * @returns a model or undefined
     */
    static async find<T extends BaseModel>(this: ModelStatic<T>, primaryKey?: string | string): Promise<T | undefined> {
        if (!primaryKey) return undefined;
        if ((new this).multiDatabase) {
            const result = await Promise.all(MultipleDatabase.databases.map(async (db) => {
                const item = await DatabaseManager
                    .get(db.localDatabaseName)
                    ?.get(`${(new this).cName}.${primaryKey}`)
                    .then((doc) => {
                        if (!doc) return null;
                        const result = new this(doc) as T;
                        if (result._tempPeriod) {
                            result._meta._period = result._tempPeriod;
                            delete result._tempPeriod;
                        }
                        return result;
                    })
                    .catch(() => null);
                if (item) return item;
                return undefined;
            }));
            return result.find((item) => item !== undefined);
        }
        const item = await RepoManager.get(new this()).getDoc(primaryKey);
        if (!item) return undefined;
        const model = new this(item) as T;
        model.setForeignFieldsToModelId();
        return model;
    }
    /**
     * Create a new model
     * @param attributes attributes of the model
     * @param databasePeriod period of the database, format YYYY-MM
     * @returns a new model 
     */
    static async create<T extends BaseModel>(this: ModelStatic<T>, attributes: NewModelType<T>, databasePeriod?: string): Promise<T> {
        const model = new this() as T;
        if (model.needTimestamp) {
            attributes.createdAt = moment().format();
            attributes.updatedAt = moment().format();
        }
        model.fill(attributes as ModelType<T>);
        const hasDocumentInDb = await model.getClass().find(attributes.id);
        if (hasDocumentInDb) throw new Error('Document already exists');
        if (databasePeriod) model._meta._period = databasePeriod;
        await model.save();
        return model;
    }
    /**
     * Update an existing model
     * @param attributes attributes of the model
     * @returns this
     */
    async update(attributes: Partial<ModelType<this>>): Promise<this> {
        const guarded = this.getClass().readonlyFields;
        attributes.id = this.id;
        delete attributes.relationships;
        if (this.needTimestamp) attributes.updatedAt = moment().format();
        let updateAttributes: Partial<ModelType<this>> = {};
        updateAttributes = {} as Partial<ModelType<this>>;
        for (const key in attributes) {
            if (!guarded?.includes(key)) {
                updateAttributes[key as keyof ModelType<this>] = attributes[key as keyof ModelType<this>];
            }
        }
        this.fill(updateAttributes);
        await this.save();
        return this;
    }

    /**
     * Save the sub-models of this model
     * @returns this
     */
    async saveChildren(): Promise<this> {
        for (const field in this) {
            if (Array.isArray(this[field]) && (this[field] as BaseModel[])[0] instanceof BaseModel) {
                const query = this.relationships[field]?.();
                if (query?.getRelationshipType() === RelationshipType.HAS_MANY) {
                    const children = this[field] as BaseModel[];
                    const newChildren = [];
                    for (const child of children) {
                        const newChild = new (child.getClass() as ModelStatic<BaseModel>)();
                        const foreignKey = query.getForeignKey() as ModelKey<BaseModel>;
                        child[foreignKey] = this.docId;
                        newChild.fill(child);
                        await newChild.save();
                        const meta = { ...newChild._meta, };
                        meta._dirty = {};
                        meta._before_dirty = {};
                        newChild._meta = meta;
                        newChildren.push(newChild);
                    }
                    this[field] = newChildren as ModelValue<this, typeof field>;
                }
            } else if (this[field] instanceof BaseModel) {
                const query = this.relationships[field]?.();
                if (query?.getRelationshipType() === RelationshipType.HAS_ONE) {
                    const child = this[field] as BaseModel;
                    const foreignKey = query.getForeignKey() as ModelKey<BaseModel>;
                    if (!child[foreignKey]) {
                        child[foreignKey] = this.docId;
                    }
                    const newChild = new (child.getClass() as ModelStatic<BaseModel>)();
                    newChild.fill(child);
                    await newChild.save();
                    const meta = { ...newChild._meta, };
                    meta._dirty = {};
                    meta._before_dirty = {};
                    newChild._meta = meta;
                    this[field] = newChild as ModelValue<this, typeof field>;
                }
            }
        }
        return this;
    }

    bindRelationships(): this {
        if (!this.relationships) this.relationships = {};
        const relationships = getRelationships(this);
        Object.keys(relationships).forEach((key) => {
            const relationshipParams = relationships[key];
            const queryBuilder = () => {
                const relationshipName = relationshipParams[1][0];
                const relationship = getModelClass(relationshipName);
                if (relationshipParams[0] === RelationshipType.BELONGS_TO) {
                    return this.belongsTo(relationship, relationshipParams[2][0], relationshipParams[2][1]);
                }
                if (relationshipParams[0] === RelationshipType.HAS_MANY) {
                    return this.hasMany(relationship, relationshipParams[2][0], relationshipParams[2][1]);
                }
                if (relationshipParams[0] === RelationshipType.HAS_ONE) {
                    return this.hasOne(relationship, relationshipParams[2][0], relationshipParams[2][1]);
                }
                if (relationshipParams[0] === RelationshipType.BELONGS_TO_MANY) {
                    const pivotName = relationshipParams[1][1];
                    const pivot = getModelClass(pivotName);
                    return this.belongsToMany(relationship, pivot, relationshipParams[2][0], relationshipParams[2][1]);
                }
                return new QueryBuilder(this);
            };
            this.relationships[key] = queryBuilder as () => QueryBuilder<this, []>;
        });
        return this;
    }

    private async saveCollectionName() {
        const db = DatabaseManager.get(this.dName);
        if (!db) return;
        await new Promise((resolve) => {
            db.get(`Collections.${this.cName}`).catch(async () => {
                await db.put({
                    _id: `Collections.${this.cName}`,
                    name: this.cName,
                    className: this.getClass().name,
                }).catch(() => {
                    resolve(true);
                }).then(() => {
                    resolve(true);
                });
            }).then(() => {
                resolve(true);
            });
        });
    }

    /**
     * Save a model into database
     * @returns this
     */
    async save(): Promise<this> {
        await this.saveCollectionName();

        let newAttributes: Partial<this> & { _rev?: string } = {};
        for (const field in this) {
            if (field === '_meta') continue;
            if (field === 'relationships') continue;
            if (field === 'needTimestamp') continue;
            if (field === 'cName') continue;
            if (this._meta._dirty && !this._meta._dirty[field] && !Array.isArray(this[field])) continue;
            if (this[field] instanceof BaseModel) continue;
            if (Array.isArray(this[field]) && (this[field] as any)[0] instanceof BaseModel) continue;
            newAttributes[field] = this[field];
        }
        newAttributes = convertIdFieldsToDocIds(newAttributes, this);
        const now = moment().format();
        let updatedResult;

        let hasDocumentInDb;
        if (this.id) {
            if (this.multiDatabase) {
                hasDocumentInDb = await MultiQueryBuilder.query(new (this.getClass())).find(this.id);
            } else {
                hasDocumentInDb = await this.getClass().query().find(this.id);
            }
        }
        // add static beforeSave function
        if (this.getClass().beforeSave) {
            await this.getClass().beforeSave(this);
        }

        if (this.needTimestamp) newAttributes.updatedAt = now;
        if (!hasDocumentInDb) {
            if (this.needTimestamp) newAttributes.createdAt = now;
            if (this.needTimestamp) newAttributes.updatedAt = now;
            if (this.getClass().beforeCreate) {
                await this.getClass().beforeCreate(this);
            }
            if (this.multiDatabase) {
                const currentPeriod = this._meta._period || moment().format('YYYY-MM');
                updatedResult = await MultiQueryBuilder.query(new (this.getClass())).create(newAttributes as NewModelType<this>, currentPeriod);
                this._meta._period = currentPeriod;
            } else {
                updatedResult = await this.getClass().repo().create(newAttributes);
            }
            this.fill({ id: updatedResult.id, } as Partial<ModelType<this>>);
            if (this.getClass().afterCreate) {
                await this.getClass().afterCreate(this);
            }
        } else {
            const guarded = this.getClass().readonlyFields;
            if (guarded && guarded.length > 0) {
                for (const field of guarded) {
                    delete newAttributes[field as ModelKey<this>];
                    newAttributes[field as keyof this] = this.getBeforeDirtyValue(field as ModelKey<this>) as ModelValue<this, ModelKey<this>>;
                }
            }
            if (this.needTimestamp) newAttributes.updatedAt = now;
            newAttributes.id = this.docId;
            if (this.getClass().beforeUpdate) {
                await this.getClass().beforeUpdate(this);
            }
            if (this.multiDatabase) {
                updatedResult = await MultiQueryBuilder.query(new (this.getClass())).update(newAttributes, this._meta._period);
            } else {
                updatedResult = await this.getClass().repo().update(newAttributes);
            }
            if (this.getClass().afterCreate) {
                await this.getClass().afterCreate(this);
            }
        }
        delete newAttributes._rev;
        this.fill({ ...newAttributes, _rev: updatedResult.rev, } as Partial<ModelType<this>>);
        await this.saveChildren();

        // add static afterSave function
        if (this.getClass().afterSave) {
            await this.getClass().afterSave(this);
        }
        this.fill({ ...newAttributes, _rev: updatedResult.rev, } as Partial<ModelType<this>>);
        this.id = this.modelId;
        this.setForeignFieldsToModelId();
        if (!this.relationships) this.bindRelationships();
        this._meta._dirty = {};
        this._meta._before_dirty = {};
        return this;
    }
    /**
     * Delete a model from database
     * @returns void
     */
    async delete(forceDelete = false): Promise<void | this> {
        if (this.getClass().beforeDelete) {
            await this.getClass().beforeDelete(this);
        }
        if (this.getClass().softDelete && !forceDelete) {
            this.deletedAt = moment().format();
            await this.save();
        } else {
            if (this.multiDatabase) {
                const periodDbName = `${getMainDatabaseName()}-${this._meta._period}`;
                await QueryBuilder.query(this, undefined, periodDbName).setPeriod(this._meta._period).deleteOne(this.id);
            } else {
                await this.getClass().repo().deleteOne(this.id);
            }
            Object.keys(this).forEach((key) => delete this[key as keyof this]);
        }
        if (this.getClass().afterDelete) {
            await this.getClass().afterDelete(this);
        }
        // if (this.getClass().softDelete) {
        //     return this;
        // }
    }
    /**
     * Remove a field from the model
     * @returns this
     */
    async removeField(field: string): Promise<this> {
        delete this[field as keyof this];
        this._meta._dirty[field] = true;
        return this.save();
    }
    // end of CRUD operation

    // start of soft delete feature
    static withTrashed<T extends BaseModel>(this: ModelStatic<T>): QueryBuilder<T> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).withTrashed();
    }
    static onlyTrashed<T extends BaseModel>(this: ModelStatic<T>): QueryBuilder<T> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).onlyTrashed();
    }
    static withoutTrashed<T extends BaseModel>(this: ModelStatic<T>): QueryBuilder<T> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName).withoutTrashed();
    }

    async restore(): Promise<this> {
        if (!this.needSoftDelete) throw new Error('This model does not support soft delete');
        delete this.deletedAt;
        const json = {
            ...this.toJson(),
            _id: this.docId,
            id: undefined,
            _rev: this._meta._rev,
        };
        const db = DatabaseManager.get(this.getClass().dbName);
        await db?.put(json);
        return this;
    }
    // end of soft delete feature

    // start of query builder
    /**
     * Query for specific database
     * @param dbName database name that return from DatabaseManager.get()
     * @returns Model Query Builder with specific database
     */
    static via<T extends BaseModel>(this: ModelStatic<T>, dbName: string): QueryBuilder<T> {
        return new QueryBuilder<T>(new this, undefined, dbName);
    }

    /**
     * Query default database defined in the model
     * @returns Model Query Builder
     */
    static query<T extends BaseModel>(this: ModelStatic<T>): QueryBuilder<T> {
        return new QueryBuilder<T>(new this, undefined, (this as unknown as typeof BaseModel).dbName);
    }

    static where<T extends BaseModel>(this: ModelStatic<T>, condition: (query: QueryBuilder<T>) => void): QueryBuilder<T>;
    static where<T extends BaseModel>(this: ModelStatic<T>, queryableModel: Partial<QueryableModel<T>>): QueryBuilder<T>;
    static where<T extends BaseModel, Key extends ModelKey<T>>(this: ModelStatic<T>, field: Key | string, value: OperatorValue<T, Key, '='>): QueryBuilder<T>;
    static where<T extends BaseModel, Key extends ModelKey<T>, O extends Operator>(this: ModelStatic<T>, field: Key | string, operator: O, value: OperatorValue<T, Key, O>): QueryBuilder<T>;
    static where<T extends BaseModel, Key extends ModelKey<T>, O extends Operator>(...args: (ModelKey<T> | O | OperatorValue<T, Key, O>)[]): QueryBuilder<T> {
        const query = new QueryBuilder(new this, undefined, (this as unknown as typeof BaseModel).dbName);
        // @ts-ignore
        return query.where(...args);
    }
    // end of query builder

    // start of relationship
    /**
     * Eager load relationships
     * @param relationships all relationships to load, support dot notation
     * @returns 
     */
    static with<T extends BaseModel, K extends string[]>(this: ModelStatic<T>, ...relationships: string[]): QueryBuilder<T> {
        const model = new this;
        return new QueryBuilder<T, []>(model, relationships as unknown as ValidDotNotationArray<T, []>, (this as unknown as typeof BaseModel).dbName);
    }
    /**
     * Load relationships to current model
     * @param relationships all relationships to load, support dot notation
     * @returns 
     */
    async load<K extends string[]>(...relationships: string[]): Promise<this> {
        const klass = this.getClass();
        const newInstance = new klass() as this;
        const builder = new QueryBuilder(newInstance, relationships, this.dName);
        builder.where('id', '=', this.id);
        const loadedModel = await builder.first() as this;
        for (const relationship of relationships) {
            this[relationship as keyof this] = loadedModel[relationship as keyof this];
        }
        return this;
    }

    belongsTo<R extends BaseModel>(relationship: ModelStatic<R>, localKey?: string, foreignKey?: string): QueryBuilder<R> {
        return belongsTo<this, R>(this, relationship, localKey as ModelKey<this>, foreignKey as ModelKey<R>);
    }
    hasOne<R extends BaseModel>(relationship: ModelStatic<R>, localKey?: string, foreignKey?: string): QueryBuilder<R> {
        return hasOne<this, R>(this, relationship, localKey as ModelKey<this>, foreignKey as ModelKey<R>);
    }
    hasMany<R extends BaseModel>(relationship: ModelStatic<R>, localKey?: string, foreignKey?: string): QueryBuilder<R> {
        return hasMany<this, R>(this, relationship, localKey as ModelKey<this>, foreignKey as ModelKey<R>);
    }
    async belongsToMany<R extends BaseModel, P extends BaseModel>(relationship: ModelStatic<R>, pivot: ModelStatic<P>, localKey?: string, foreignKey?: string): Promise<QueryBuilder<R>> {
        return await belongsToMany<this, R, P>(this, relationship, pivot, localKey as ModelKey<P>, foreignKey as ModelKey<P>);
    }
    // end of relationship

    // start api method
    /**
     * Call backend API method for the resource
     * @param apiPath Path name
     * @param params Parameters
     * @param method 'GET' | 'POST' | 'PUT' | 'DELETE'
     * @returns 
     */
    public static api<Result, Params extends object>(apiPath: string, params: Params, method: APIMethod = 'POST'): Promise<Result> {
        return this.repo().api?.callApi(method, apiPath, params) as Promise<Result>;
    }
    /**
     * Call backend API method for the resource with id
     * @param apiPath Path name
     * @param method 'GET' | 'POST' | 'PUT' | 'DELETE'
     * @returns 
     */
    public api<Result>(apiPath: string, method: APIMethod = 'POST'): Promise<this | Result> {
        return this.getClass().repo().api?.callModelApi(method, apiPath, this.toJson()) as Promise<this | Result>;
    }
    // end api method

    // start of lifecycle
    public static async beforeSave<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }
    public static async afterSave<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }

    public static async beforeCreate<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }
    public static async afterCreate<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }

    public static async beforeUpdate<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }
    public static async afterUpdate<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }

    public static async beforeDelete<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }
    public static async afterDelete<Result, T extends BaseModel>(model: T): Promise<Result | BaseModel> {
        return model;
    }
    // end of lifecycle

    /**
     * Convert model to a plain object
     * @returns javascript object
     */
    public toJson(): Partial<ModelType<this>> {
        const json: Partial<this> = {};
        for (const field in this) {
            if (field === '_meta') continue;
            if (field === 'relationships') continue;
            if (field === 'needTimestamp') continue;
            if (field === 'cName') continue;
            if (this.relationships && Object.keys(this.relationships).includes(field)) continue;
            json[field as keyof this] = this[field];
        }
        return json;
    }

    // start transformer for api response 
    formatResponse?<Output>(cloneSelf: this): Output {
        delete (cloneSelf as Partial<this>)._meta;
        delete (cloneSelf as Partial<this>).relationships;
        return cloneSelf as unknown as Output;
    }

    public toResponse() {
        const replicatedModel = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        delete replicatedModel.save;
        for (const key in replicatedModel) {
            let formattedResult;
            if (Array.isArray(replicatedModel[key]) && (replicatedModel[key] as unknown as BaseModel[])[0] instanceof BaseModel) {
                formattedResult = (replicatedModel[key] as unknown as BaseModel[]).map(m => m.toResponse());
            } else if (replicatedModel[key] instanceof BaseModel) {
                formattedResult = (replicatedModel[key] as unknown as BaseModel).toResponse();
            }
            if (!formattedResult) continue;
            replicatedModel[key] = formattedResult;
        }
        if (this.formatResponse) {
            return this.formatResponse(replicatedModel);
        }
        if (!replicatedModel) throw new Error(`${this.getClass().name}.formatResponse() must return an object`);
        return replicatedModel;
    }
    // end transformer for api response

    // start dirty maintenance
    /**
     * Check if the model or attribute is dirty
     * @param attribute can be undefined, if undefined, check if the model is dirty, otherwise check if the attribute is dirty
     * @returns 
     */
    isDirty(attribute?: ModelKey<this>): boolean {
        if (attribute) return !!this._meta._dirty[attribute as string];
        // return this._meta._dirty whereas the boolean value is true
        return Object.keys(this._meta._dirty).some(key => this._meta._dirty[key]);
    }
    /**
     * Get the value of the attribute before it is dirty
     * @param attribute the attribute that which to check
     * @returns 
     */
    getBeforeDirtyValue<Key extends ModelKey<this>>(attribute: Key): ModelValue<this, Key> {
        return this._meta._before_dirty[attribute as string];
    }
    /**
     * A method to check if this model is not the latest version with the database
     * @returns 
     */
    isOutdated(): boolean {
        return needToReload(this, this.id);
    }
    notifyUpdate() {
        if (this._meta && this._meta._update_callbacks) {
            this._meta._update_callbacks.forEach(callback => callback());
        }
    }
    /**
     * Trigged when the model is being update in the database
     * @param callback 
     */
    onChange(callback: Function) {
        if (!this._meta._update_callbacks) this._meta._update_callbacks = [];
        this._meta._update_callbacks.push(callback);
    }
    // end dirty maintenance

    // start of join
    // TODO: add join methods
    isJoinField(field: string): boolean {
        return false;
        // return this._join_fields[field] !== undefined;
    }
    // end of join
}

export { BaseModel as Model };