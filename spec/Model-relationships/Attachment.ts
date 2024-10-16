import { BelongsTo, Model } from 'src/index';
import { PocketModel } from 'src/model/ModelDecorator';
import { PostRelationship } from './PostRelationship';

const dbName = 'model-relationships';
@PocketModel
export class Attachment extends Model {
    static dbName = dbName;

    name!: string;
    url!: string;
    postId!: string;

    @BelongsTo('PostRelationship', 'id', 'postId') post?: PostRelationship;
}