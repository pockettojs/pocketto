import { BaseModel } from 'src/model/Model';

export const sanitizeMeta = (instance: BaseModel) => {
    instance._meta._dirty = new Set<string>();
    instance._meta._before_dirty = {};
};

export const sanitizeMetaIfNone = (instance: BaseModel) => {
    if (!instance._meta._dirty) instance._meta._dirty = new Set<string>();
    if (!instance._meta._before_dirty) instance._meta._before_dirty = {};
};