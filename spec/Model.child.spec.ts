import { DatabaseManager } from 'src/manager/DatabaseManager';
import { ChildUser } from './model-child/ChildUser';
import { ChildPost } from './model-child/ChildPost';
import { ChildIdentityCard } from './model-child/ChildIdentityCard';

const dbName = 'model-child';

describe('Model Child', () => {

    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should be able to save with relationships', async () => {
        const user = await ChildUser.create({
            name: 'John',
            posts: [
                new ChildPost({ title: 'hello world', }),
                new ChildPost({ title: 'hi world', }),
            ],
        });
        expect(user).toBeInstanceOf(ChildUser);

        const posts = user.posts as ChildPost[];

        const post1 = posts[0];
        const dbPost1 = await ChildPost.find(post1.id) as ChildPost;
        expect(dbPost1).toBeInstanceOf(ChildPost);
        expect(dbPost1).toEqual(jasmine.objectContaining({
            title: post1.title,
            userId: user.id,
        }));

        const dbUser = await dbPost1.relationships.user().first();
        expect(dbUser).toBeInstanceOf(ChildUser);
        expect(dbUser).toEqual(jasmine.objectContaining({
            name: user.name,
        }));


        const post2 = posts[0];
        const dbPost2 = await ChildPost.find(post2.id);
        expect(dbPost2).toBeInstanceOf(ChildPost);
        expect(dbPost2).toEqual(jasmine.objectContaining({
            title: post2.title,
        }));

        await user.update({
            identityCard: new ChildIdentityCard({ number: '123456', }),
        });
        const card = user.identityCard as ChildIdentityCard;
        const dbCard = await ChildIdentityCard.find(card.id);
        expect(card).toBeInstanceOf(ChildIdentityCard);
        expect(dbCard).toEqual(jasmine.objectContaining({
            id: card.id,
            number: card.number,
        }));
    });
});