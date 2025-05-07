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
        const now = moment.utc().format('YYYY-MM-DDTHH:mm:ss');
        const utcDate = moment(now).add(this.toUtc, 'h').utcOffset(this.toUtc);
        return utcDate.format('YYYY-MM-DDTHH:mm:ssZ');
    }

    /**
     * Converts a UTC time to the local time zone.
     * @param time the time format must be YYYY-MM-DDTHH:mm:ssZ
     * @returns 
     */
    from(time: string): string {
        if (!Utc.isTimestampWithUtc(time)) {
            throw new Error('Invalid time format. Expected format: YYYY-MM-DDTHH:mm:ssZ');
        }
        const utcDate = moment(time).utcOffset(this.toUtc);
        return utcDate.format('YYYY-MM-DDTHH:mm:ssZ');
    }
}