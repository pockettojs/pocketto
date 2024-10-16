import { RelationshipType } from 'src/definitions/RelationshipType';
import { BaseModel } from '../model/Model';
import { ModelStatic } from 'src/definitions/Model';
import { getModelClass } from '..';

export type RelationshipParams = [RelationshipType, Array<string>, Array<string | undefined>];

export type ForeignKeyModelMapper = {
    [model: string]: ForeignTypeMapper;
};

export type ForeignTypeMapper = {
    [key: string]: RelationshipParams;
};

export const foreignKeys: ForeignKeyModelMapper = {};

export function setRelationship(target: BaseModel, propertyKey: string, params: RelationshipParams) {
    if (!(target instanceof BaseModel)) throw new Error('Target must be an instance of BaseModel');
    if (!foreignKeys[target.cName]) foreignKeys[target.cName] = {};
    foreignKeys[target.cName][propertyKey] = params;
}

export function getRelationships<T extends BaseModel>(model: T) {
    return foreignKeys[model.cName] || {};
}

type ForeignIdMeta = {
    relationship: ModelStatic<BaseModel>;
    field: string;
};


export function getLocalIdFields<T extends BaseModel>(model: T): Array<ForeignIdMeta> {
    const relationships = getRelationships(model);
    let fields = Object.keys(relationships).map((key) => {
        if (relationships[key][0] === RelationshipType.BELONGS_TO) {
            const relationshipName = relationships[key][1][0];
            const relationship = getModelClass(relationshipName);
            return {
                relationship,
                field: relationships[key][2][0],
            };
        }
        return undefined;
    });
    fields = [...new Set(fields),];
    const idFields = fields.filter((item) => item !== undefined && item.relationship !== undefined) as ForeignIdMeta[];
    return idFields;
}

export function getForeignIdFields<T extends BaseModel>(model: T): Array<ForeignIdMeta> {
    const relationships = getRelationships(model);
    let fields = Object.keys(relationships).map((key) => {
        if (relationships[key][0] === RelationshipType.BELONGS_TO) {
            const relationshipName = relationships[key][1][0];
            const relationship = getModelClass(relationshipName);
            return {
                relationship,
                field: relationships[key][2][1],
            };
        }
        return undefined;
    });
    fields = [...new Set(fields),];
    const idFields = fields.filter((item) => item !== undefined && item.relationship !== undefined) as ForeignIdMeta[];
    return idFields;
}


export function convertIdFieldsToDocIds<T extends BaseModel, Attributes extends Partial<BaseModel>>(attributes: Attributes, model: T): Attributes {
    const idFields = [...getForeignIdFields(model), ...getLocalIdFields(model),];
    for (const idField of idFields) {
        if (idField.field === 'id') continue;
        const relationship = new idField.relationship;
        const prefix = relationship.cName + '.';
        const foreignKeyField = attributes[idField.field as keyof typeof attributes] as string;
        if (!foreignKeyField) continue;
        if (!foreignKeyField.includes(prefix)) {
            attributes[idField.field as keyof typeof attributes] = prefix + attributes[idField.field as keyof typeof attributes] as Attributes[keyof Attributes];
        }
    }
    return attributes;
}
export function convertIdFieldsToModelIds<T extends BaseModel, Attributes extends Partial<BaseModel>>(attributes: Attributes, model: T): Attributes {
    const idFields = [...getForeignIdFields(model), ...getLocalIdFields(model),];
    for (const idField of idFields) {
        if (idField.field === 'id') continue;
        const relationship = new idField.relationship;
        const prefix = relationship.cName + '.';
        const foreignKeyField = attributes[idField.field as keyof typeof attributes] as string;
        if (!foreignKeyField) continue;
        if (foreignKeyField.includes(prefix)) {
            attributes[idField.field as keyof typeof attributes] = (attributes[idField.field as keyof typeof attributes] as string)
                .replace(prefix, '') as Attributes[keyof Attributes];
        }
    }
    return attributes;
}

export function BelongsTo(relationship: string, localKey?: string, foreignKey?: string) {
    return function <T extends BaseModel>(target: T, propertyKey: string) {
        if (!target.relationships) {
            target.relationships = {};
        }
        setRelationship(target, propertyKey, [RelationshipType.BELONGS_TO, [relationship,], [localKey, foreignKey,],]);
    };
}

export function HasOne(relationship: string, localKey?: string, foreignKey?: string) {
    return function <T extends BaseModel>(target: T, propertyKey: string) {
        if (!target.relationships) {
            target.relationships = {};
        }
        setRelationship(target, propertyKey, [RelationshipType.HAS_ONE, [relationship,], [localKey, foreignKey,],]);
    };
}

export function HasMany(relationship: string, localKey?: string, foreignKey?: string) {
    return function <T extends BaseModel>(target: T, propertyKey: string) {
        if (!target.relationships) {
            target.relationships = {};
        }
        setRelationship(target, propertyKey, [RelationshipType.HAS_MANY, [relationship,], [localKey, foreignKey,],]);
    };
}

export function BelongsToMany(relationship: string, pivot: string, localKey?: string, foreignKey?: string) {
    return function <T extends BaseModel>(target: T, propertyKey: string) {
        if (!target.relationships) {
            target.relationships = {};
        }
        setRelationship(target, propertyKey, [RelationshipType.BELONGS_TO_MANY, [relationship, pivot,], [localKey, foreignKey,],]);
    };
}