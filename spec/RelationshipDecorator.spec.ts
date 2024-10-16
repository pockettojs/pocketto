import { DatabaseManager, BaseModel, Model, BelongsTo } from 'src/index';
import { PocketModel } from 'src/model/ModelDecorator';
import { HasMany } from 'src/relationships/RelationshipDecorator';

const dbName = 'relationship-decorator';

describe('Relationship Decorator', () => {
    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should able to query post', async () => {
        @PocketModel
        class DecoratorPost extends Model {
            static dbName = dbName;
            static softDelete = false;

            userId!: string;

            @BelongsTo('DecoratorUser', 'userId', 'id') user?: DecoratorUser;
        }

        @PocketModel
        class DecoratorUser extends Model {
            static dbName = dbName;
            static softDelete = false;
            name!: string;

            @HasMany('DecoratorPost', 'id', 'userId') posts?: DecoratorPost[];
        }
        const user = await DecoratorUser.create({ name: 'test', });
        await DecoratorPost.create({ userId: user.id, });
        await DecoratorPost.create({ userId: user.id, });
        expect(user).toBeInstanceOf(DecoratorUser);
        await user.load('posts');
        const posts = user.posts;
        expect(posts).toBeInstanceOf(Array);
        expect(posts?.length).toEqual(2);
        expect(posts?.[0]).toBeInstanceOf(DecoratorPost);

        await user.save();
        const post1 = await DecoratorPost.find(user.posts![0].id);
        expect(post1).toEqual(user.posts![0]);
    });
});