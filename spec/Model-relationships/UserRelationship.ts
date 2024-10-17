import { HasMany, Model } from 'src/index';
import { Pocketto } from 'src/model/ModelDecorator';
import { PostRelationship } from './PostRelationship';

const dbName = 'model-relationships';
@Pocketto
export class UserRelationship extends Model {
    static dbName = dbName;

    name!: string;
    password?: string;

    @HasMany('PostRelationship', 'id', 'userId') posts?: PostRelationship[];
}