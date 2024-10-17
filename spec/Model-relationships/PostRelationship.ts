import { BelongsTo, HasMany, Model } from 'src/index';
import { Pocketto } from 'src/model/ModelDecorator';
import { Attachment } from './Attachment';
import { UserRelationship } from './UserRelationship';

const dbName = 'model-relationships';
@Pocketto
export class PostRelationship extends Model {
    static dbName = dbName;

    title!: string;
    userId!: string;
    content?: string;
    @HasMany('Attachment', 'id', 'postId') attachments?: Attachment[];
    @BelongsTo('UserRelationship', 'id', 'userId') user?: UserRelationship;
}