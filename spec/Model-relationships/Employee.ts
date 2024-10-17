import { BelongsTo, Model } from 'src/index';
import { Pocketto } from 'src/model/ModelDecorator';
import { UserRelationship } from './UserRelationship';

const dbName = 'model-relationships';
@Pocketto
export class Employee extends Model {
    static dbName = dbName;

    name!: string;
    password?: string;
    userId!: string;

    @BelongsTo('UserRelationship', 'id', 'userId') user?: UserRelationship;
}