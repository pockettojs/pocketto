const isBrowser = typeof window !== 'undefined';

function set<T>(key: string, value: T) {
    if (!isBrowser) return;

    if (typeof value === 'object') {
        window.localStorage.setItem(key, JSON.stringify(value));
    } else if (typeof value === 'string') {
        window.localStorage.setItem(key, value);
    } else if (typeof value === 'number') {
        window.localStorage.setItem(key, value as unknown as string);
    }
}

function clear(key: string) {
    if (!isBrowser) return;
    window.localStorage.removeItem(key);
}

function get(key: string) {
    if (!isBrowser) return;
    const item = window.localStorage.getItem(key);
    if (!item) return undefined;
    const objectRegex = /^\{.*\}$/;
    if (objectRegex.test(item)) {
        return JSON.parse(item);
    }
    return item;
}


export class Persistor {
    static set<T>(value: T) {
        set(this.name, value);
    }
    static clear() {
        clear(this.name);
    }
    static get<T>(): T | undefined {
        return get(this.name);
    }
}