import pluralize from 'pluralize';
import { BaseModel } from '..';

export type ModelMapper = {
    [model: string]: typeof BaseModel;
};

export const classes: ModelMapper = {};

export function PocketModel<T extends typeof BaseModel>(model: T) {
    if (classes[model.name]) return;
    classes[model.name] = model;
}

export function getModelClass(modelName: string): typeof BaseModel {
    if (!classes[modelName]) throw new Error(`Model ${modelName} not found`);
    return classes[modelName];
}

export function getModelName(collectionName: string): string | null {
    for (const key of Object.keys(classes)) {
        if (collectionName === (classes[key].collectionName || pluralize(classes[key].name))) return key;
    }
    return null;
}