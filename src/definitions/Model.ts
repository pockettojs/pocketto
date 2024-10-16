// reference from: https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c
export type ReservedFieldForSelect = 'cName' | 'dName' | 'multiDatabase' | 'needTimestamp' | 'needSoftDelete' | 'relationships' | '_meta' | '_tempPeriod' | 'formatResponse' | '_id' | '_rev' | 'aName' | 'aResource' | 'aAuto' | 'docId' | 'modelId';
export type FunctionlessModel<T> = Omit<Omit<T, {
    [Key in keyof T]: T[Key] extends Function ? Key : never;
}[keyof T]>, ReservedFieldForSelect>;

export type ModelStatic<T extends object> = {
    new(attributes?: ModelType<T> | object): T
};
export type ModelType<T extends object> = FunctionlessModel<T> & {
    id: string;
    docId: string;
    modelId: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
    cName?: unknown;
    dName?: unknown;
    needTimestamp?: unknown;
    relationships?: { [relationshipName: string]: () => Promise<object> | object | void };
    _meta: {
        _dirty?: { [key: string]: boolean };
        _before_dirty?: { [key: string]: any };
        _fallback_api_doc?: boolean;
        _rev: string;
        _period?: string;
    };
    _tempPeriod?: string;
};
export type NewModelType<T extends object> = Omit<ModelType<T>, 'id' | '_meta' | 'docId' | 'modelId' | ReservedFieldForSelect> & {
    id?: string;
    docId?: string;
    modelId?: string;
    _tempPeriod?: string;
};
export type ModelKey<T extends object> = keyof FunctionlessModel<T> | 'id';
export type ModelValue<T extends object, Key extends keyof T> = T[Key];


