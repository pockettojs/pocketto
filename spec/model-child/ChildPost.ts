import { Model } from 'src/model/Model';
import { BelongsTo } from 'src/index';
import { PocketModel } from 'src/model/ModelDecorator';
import { ChildUser } from './ChildUser';

const dbName = 'model-child';
@PocketModel
export class ChildPost extends Model {
    static dbName = dbName;

    title!: string;
    userId!: string;
    content?: string;
    @BelongsTo('ChildUser', 'userId', 'id') user?: ChildUser;
}