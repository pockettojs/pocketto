import { DatabaseManager } from 'src/manager/DatabaseManager';
import { RepoManager } from 'src/manager/RepoManager';
import { UserRelationship } from './model-relationships/UserRelationship';
import { PostRelationship } from './model-relationships/PostRelationship';
import { Employee } from './model-relationships/Employee';
import { Attachment } from './model-relationships/Attachment';

const dbName = 'model-relationships';

describe('Model Relationships', () => {
    beforeEach(async () => {
        await DatabaseManager.connect(dbName, { dbName, adapter: 'memory', silentConnect: true, });
    });

    it('should be able to save without relationships', async () => {
        const user = await UserRelationship.create({
            name: 'John',
        });
        expect(user).toBeInstanceOf(UserRelationship);

        const post1 = await PostRelationship.create({ title: 'hello world', userId: user.id, });
        const post2 = await PostRelationship.create({ title: 'nice to meet you, Malaysia', userId: user.id, });

        await user.load('posts');
        expect(user.posts?.length).toBe(2);
        const posts = await user.relationships.posts().get();
        expect(posts.length).toBe(2);

        const posts2 = await PostRelationship.where('userId', user.id).get();
        expect(posts2.length).toBe(2);

        const dbPost1Index = user.posts?.findIndex((p) => p.id === post1.id) as number;
        expect(user.posts?.[dbPost1Index]).toEqual(jasmine.objectContaining({
            id: post1.id,
            title: post1.title,
            createdAt: post1.createdAt,
            updatedAt: post1.updatedAt,
        }));
        expect(user.posts?.[dbPost1Index]._meta._rev).toBe(post1._meta._rev);

        const dbPost2Index = user.posts?.findIndex((p) => p.id === post2.id) as number;
        expect(user.posts?.[dbPost2Index]).toEqual(jasmine.objectContaining({
            id: post2.id,
            title: post2.title,
            createdAt: post2.createdAt,
            updatedAt: post2.updatedAt,
        }));
        expect(user.posts?.[dbPost2Index]._meta._rev).toBe(post2._meta._rev);
    });

    it('should not save relationship detail within the model', async () => {
        const user = await UserRelationship.create({ name: 'Jane', });
        await PostRelationship.create({ title: 'hello world', userId: user.id, });
        await PostRelationship.create({ title: 'nice to meet you, Malaysia', userId: user.id, });
        await user.load('posts');
        user.name = 'John';
        await user.save();

        const userCreated = await RepoManager.get(new UserRelationship).getDoc(user.id) as any;
        expect(userCreated).toEqual(jasmine.objectContaining({
            id: user.docId,
            name: user.name,
        }));
        expect(userCreated._rev).toBe(user._meta._rev);
        expect(userCreated.posts).toBeUndefined();
    });

    it('should able to save sub-relationship', async () => {
        const user = await UserRelationship.create({ name: 'Jane', });
        await PostRelationship.create({ title: 'hello world', userId: user.id, });
        await PostRelationship.create({ title: 'nice to meet you, Malaysia', userId: user.id, });
        await user.load('posts');

        user.posts![0].title = 'Hi world';
        await user.posts![0].save();
        const postedUpdated = await RepoManager.get(new PostRelationship).getDoc(user.posts![0].id);
        expect(postedUpdated).toEqual(jasmine.objectContaining({
            id: user.posts![0].docId,
            _rev: user.posts![0]._meta._rev,
            title: user.posts![0].title,
            createdAt: user.posts![0].createdAt,
            updatedAt: user.posts![0].updatedAt,
        }));
    });

    it('should able to load sub-relationship', async () => {
        const user = await UserRelationship.create({ name: 'Jane', });
        await PostRelationship.create({ title: 'hello world', userId: user.id, });
        await PostRelationship.create({ title: 'nice to meet you, Malaysia', userId: user.id, });
        const dbUser = await UserRelationship.with('posts').find(user.id);

        expect(dbUser?.posts?.length).toBe(2);
        expect(dbUser).toEqual(jasmine.objectContaining({
            id: user.id,
            name: user.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }));
        expect(dbUser?._meta._rev).toBe(user._meta._rev);
    });

    it('should able to load multi level sub-relationship', async () => {
        const user = await UserRelationship.create({
            name: 'Hall', posts: [
                new PostRelationship({
                    title: 'hello world', attachments: [
                        new Attachment({ name: 'attachment 1', url: 'http://example.com/1', }),
                        new Attachment({ name: 'attachment 2', url: 'http://example.com/2', }),
                        new Attachment({ name: 'attachment 3', url: 'http://example.com/3', }),
                        new Attachment({ name: 'attachment 4', url: 'http://example.com/4', }),
                    ],
                }),
            ],
        });
        expect(user.posts?.length).toBe(1);
        expect(user.posts?.[0].attachments?.length).toBe(4);
        const dbUser = await UserRelationship.with('posts', 'posts.attachments').find(user.id) as UserRelationship;
        dbUser.posts![0].attachments?.sort((a, b) => a.name.localeCompare(b.name));
        const dbPost = dbUser.posts![0];
        expect(dbPost.attachments?.length).toBe(4);
        expect(dbPost.attachments).toEqual((user.posts as PostRelationship[])[0].attachments);
    });

    it('should not query Employee when query PostRelationship from UserRelationship', async () => {
        const user = await UserRelationship.create({ name: 'John', });
        await PostRelationship.create({ title: 'hello world', userId: user.id, });
        await PostRelationship.create({ title: 'nice to meet you, Malaysia', userId: user.id, });
        await Employee.create({ name: 'John', userId: user.id, });
        await user.load('posts');
        expect(user.posts?.length).toBe(2);
        const posts = await user.relationships.posts().get();
        expect(posts.length).toBe(2);
    });
});