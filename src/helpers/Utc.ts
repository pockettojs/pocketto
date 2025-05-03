import moment from 'moment';

export class Utc {
    toUtc: number;

    constructor(toUtc: number = 0) {
        this.toUtc = toUtc;
    }

    static isTimestampWithUtc(time: string): boolean {
        const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/;
        return utcPattern.test(time);
    }

    now(): string {
        const moment = require('moment');
        const now = moment.utc().format('YYYY-MM-DDTHH:mm:ss');
        const utcDate = moment(now).utcOffset(this.toUtc);
        return utcDate.format('YYYY-MM-DDTHH:mm:ssZ');
    }

    from(time: string): string {
        const utcDate = moment(time).utcOffset(this.toUtc);
        return utcDate.format('YYYY-MM-DDTHH:mm:ssZ');
    }
}