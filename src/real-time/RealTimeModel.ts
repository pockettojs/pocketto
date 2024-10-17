import { DatabaseManager } from 'src/manager/DatabaseManager';
import { BaseModel, Model } from 'src/model/Model';
import EventEmitter from 'events';
import { getModelClass, getModelName } from '..';

export let isRealTime = false;
const dbChangeListenerMap: { [key: string]: PouchDB.Core.Changes<any> | undefined } = {};

export const docEvent = new EventEmitter();
export function emitChangeEvent(_id: string, doc: BaseModel) {
    docEvent.emit('docChange', _id, doc);
}

export function onDocChange(listener: (id: string, doc: BaseModel) => void | Promise<void>) {
    return docEvent.on('docChange', listener);
}

export function setRealtime(realTime: boolean) {
    isRealTime = realTime;
    const onRealTimeChange = async (change: PouchDB.Core.ChangesResponseChange<any>, name: string) => {
        const _id = change.doc?._id || change.id;

        let doc = change.doc;
        if (!doc) {
            doc = await DatabaseManager.get(name)?.get(_id);
            doc._rev = change.changes[0].rev;
        }
        doc.id = _id;
        delete doc._id;
        const modelName = getModelName(_id.split('.')[0]);
        if (!modelName) return;
        const ExpectedModelClass = getModelClass(modelName);
        if (!ExpectedModelClass) return;
        doc = new ExpectedModelClass(doc);
        emitChangeEvent(doc.id, doc as BaseModel);
    };


    if (isRealTime) {
        Object.values(DatabaseManager.databases).forEach((db) => {
            if (!db) return;
            if (dbChangeListenerMap[db.name]) return;
            dbChangeListenerMap[db.name] = db.changes({
                since: 'now',
                include_docs: true,
                live: true,
            }).on('change', (change) => onRealTimeChange(change, db.name));
        });
    } else {
        Object.values(DatabaseManager.databases).forEach((db) => {
            db?.removeAllListeners('change');
        });
    }
}

export function needToReload(model: BaseModel, changeDocId: string): boolean {
    let needReload = false;
    for (const key of Object.keys(model)) {
        if (model.docId === changeDocId) {
            needReload = true;
            break;
        }
        if (model[key as keyof typeof model] === changeDocId) {
            needReload = true;
            break;
        }
        if (model[key as keyof typeof model] instanceof Model) {
            needReload = needToReload(model[key as keyof typeof model] as unknown as BaseModel, changeDocId);
            if (needReload) break;
        }
        if (model[key as keyof typeof model] instanceof Array && (model[key as keyof typeof model] as BaseModel[]).length > 0 && (model[key as keyof typeof model] as BaseModel[])[0] instanceof Model) {
            needReload = (model[key as keyof typeof model] as BaseModel[]).some((m) => needToReload(m, changeDocId));
            if (needReload) break;
        }
    }
    return needReload;
}

