import { Model } from 'src/model/Model';
import { HasMany, HasOne } from 'src/index';
import { Relational } from 'src/model/ModelDecorator';
import { ChildPost } from './ChildPost';
import { ChildIdentityCard } from './ChildIdentityCard';

const dbName = 'model-child';
@Relational
export class ChildUser extends Model {
    static dbName = dbName;
    static collectionName = 'Users';

    name!: string;
    password?: string;

    @HasMany('ChildPost', 'id', 'userId') posts?: ChildPost[];
    @HasOne('ChildIdentityCard', 'id', 'userId') identityCard?: ChildIdentityCard;
}