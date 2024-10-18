import { DatabaseManager } from 'src/manager/DatabaseManager';
import { BaseModel, Model } from 'src/model/Model';
import EventEmitter from 'events';

export let isRealTime = false;
const dbChangeListenerMap: { [key: string]: PouchDB.Core.Changes<any> | undefined } = {};

export const docEvent = new EventEmitter();
export function emitChangeEvent(_id: string) {
    docEvent.emit('docChange', _id);
}

export function onDocChange(listener: (id: string) => void | Promise<void>) {
    return docEvent.on('docChange', listener);
}

export function setRealtime(realTime: boolean) {
    isRealTime = realTime;
    const onRealTimeChange = async (change: PouchDB.Core.ChangesResponseChange<any>) => {
        const _id = change.doc?._id || change.id;
        emitChangeEvent(_id);
    };


    if (isRealTime) {
        Object.values(DatabaseManager.databases).forEach((db) => {
            if (!db) return;
            if (dbChangeListenerMap[db.name]) return;
            dbChangeListenerMap[db.name] = db.changes({
                since: 'now',
                include_docs: true,
                live: true,
            }).on('change', onRealTimeChange);
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

