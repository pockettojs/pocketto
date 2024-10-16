import { HasMany, Model } from 'src/index';
import { PocketModel } from 'src/model/ModelDecorator';
import { PostRelationship } from './PostRelationship';

const dbName = 'model-relationships';
@PocketModel
export class UserRelationship extends Model {
    static dbName = dbName;

    name!: string;
    password?: string;

    @HasMany('PostRelationship', 'id', 'userId') posts?: PostRelationship[];
}