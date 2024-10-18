import { BelongsTo, HasMany, Model } from 'src/index';
import { Relational } from 'src/model/ModelDecorator';
import { Attachment } from './Attachment';
import { UserRelationship } from './UserRelationship';

const dbName = 'model-relationships';
@Relational
export class PostRelationship extends Model {
    static dbName = dbName;

    title!: string;
    userId!: string;
    content?: string;
    @HasMany('Attachment', 'id', 'postId') attachments?: Attachment[];
    @BelongsTo('UserRelationship', 'id', 'userId') user?: UserRelationship;
}