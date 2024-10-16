import { singular } from 'pluralize';
import { ModelKey, ModelStatic, ModelValue } from 'src/definitions/Model';
import { RelationshipType } from 'src/definitions/RelationshipType';
import { lowerCaseFirst } from 'src/helpers/StringHelper';
import { BaseModel } from 'src/model/Model';
import { QueryBuilder } from 'src/query-builder/QueryBuilder';

export function hasMany<T extends BaseModel, R extends BaseModel>(
    self: T, relationship: ModelStatic<R>, localKey?: ModelKey<T>, foreignKey?: ModelKey<R>
) {
    const relationshipInstance = new relationship();
    if (!localKey) localKey = 'id';
    if (!foreignKey) foreignKey = `${lowerCaseFirst(singular(self.cName))}Id` as ModelKey<R>;

    const builder = new QueryBuilder<R>(relationshipInstance, undefined, self.dName);
    builder.setRelationshipType(RelationshipType.HAS_MANY, localKey as string, foreignKey as string);
    const selfCollectionName = self.cName;
    builder.where(foreignKey, '=', `${selfCollectionName}.${self[localKey]}` as ModelValue<R, ModelKey<R>>);
    return builder;
}