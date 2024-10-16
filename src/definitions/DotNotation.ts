type Path<T, K extends string> = K extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
    ? Path<T[Key] | T[Key][], Rest>
    : never
    : K extends keyof T
    ? T[K]
    : never;


export type DotNotationType<T, K extends string> = K extends `${infer Key}.${infer Rest}`
    ? T extends Array<infer U>
    ? DotNotationType<U, K>
    : Key extends keyof T
    ? DotNotationType<T[Key], Rest>
    : never
    : T extends Array<infer U>
    ? Path<U, K>
    : K extends keyof T
    ? T extends Array<infer V>
    ? V
    : T[K]
    : never;

export type ValidDotNotation<T, K extends string> = K & (DotNotationType<T, K> extends never ? never : string);

export type ValidDotNotationArray<T, K extends string[]> = K & (K extends [infer First extends string, ...infer Rest extends string[]]
    ? ValidDotNotationArray<T, Rest> extends never
    ? never
    : ValidDotNotation<T, First> extends never
    ? never
    : string[]
    : string[]);
