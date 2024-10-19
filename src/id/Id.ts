import { BaseModel } from 'src/model/Model';
import shortUuid from 'short-uuid';
import { uuidv7 } from 'uuidv7';
import { ModelStatic } from 'src/definitions/Model';
import moment from 'moment';

type IdMethod = 'shortid' | 'uuid' | 'increment' | 'safe-increment' | 'timestamp' | 'custom';
type CustomIdAssignmentFunction = (collectionName: string, collectionCount: number) => Promise<string | number>;

let idMethod: IdMethod = 'uuid';
let customFunction: CustomIdAssignmentFunction | undefined;

export function getIdMethod() {
    return idMethod;
}

export function setIdMethod(method: IdMethod, fcn?: CustomIdAssignmentFunction): void {
    idMethod = method;
    customFunction = fcn;
}

export async function getNewId<T extends BaseModel>(type?: ModelStatic<T>): Promise<string> {
    if (idMethod === 'shortid') {
        return String(shortUuid.generate());
    }

    if (idMethod === 'uuid') {
        return String(uuidv7());
    }

    if (idMethod === 'safe-increment') {
        if (!type) {
            throw new Error('Cannot use increment id method without a model type');
        }

        const collectionCount = await new type().getClass().query().count();
        return String(collectionCount + 1) + '-' + moment().format('YYYYMMDDHHmmssSSS');
    }

    if (idMethod === 'increment') {
        if (!type) {
            throw new Error('Cannot use increment id method without a model type');
        }

        const collectionCount = await new type().getClass().query().count();
        return String(collectionCount + 1);
    }

    if (idMethod === 'timestamp') {
        return moment().format('YYYYMMDDHHmmssSSS');
    }

    if (idMethod === 'custom' && customFunction && type) {
        const collectionName = new type().getClass().collectionName || '';
        const collectionCount = await new type().getClass().query().count();
        return String(await customFunction(collectionName, collectionCount));
    }

    return '';
}
