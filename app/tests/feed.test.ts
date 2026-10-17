import assert from 'node:assert/strict'
import { test } from 'node:test'
import { photoKey, rankPosts, REPOST_WEIGHT } from '../src/backend/feed'
import type { Post } from '../src/backend/posts'

const NOW = 1_700_000_000_000, H = 3_600_000
const pic = (n: number) => 'data:image/jpeg;base64,' + String.fromCharCode(...Array.from({ length: 6000 }, (_, i) => 65 + ((i * 7 + n * 13 + (i >> 3) * n) % 26)))
const post = (id: string, uid: string, photo: string, hoursAgo: number, likes: string[] = []): Post =>
  ({ id, uid, name: uid, photo, caption: '', likes, views: 0, comments: 0, at: NOW - hoursAgo * H })

test('the same photo gives the same fingerprint, a different one does not', () => {
  assert.equal(photoKey(pic(1)), photoKey(pic(1)))
  assert.notEqual(photoKey(pic(1)), photoKey(pic(2)))
})

test('people whose photos I heart come up, people whose photos I pass by sink', () => {
  const posts = [
    post('a1', 'fav', pic(1), 5, ['me']), post('a2', 'fav', pic(2), 6, ['me']),
    post('b1', 'meh', pic(3), 1), post('b2', 'meh', pic(4), 2), post('b3', 'meh', pic(5), 3),
  ]
  const order = rankPosts(posts, 'me', NOW).map(r => r.post.id)
  assert.ok(order.indexOf('a1') < order.indexOf('b3'), 'a favourite from 5 h ago beats a stranger from 3 h ago: ' + order)
  assert.ok(rankPosts(posts, 'me', NOW).find(r => r.post.id === 'a1')!.affinity > rankPosts(posts, 'me', NOW).find(r => r.post.id === 'b1')!.affinity)
  // without a taste (not signed in) nobody is a favourite: of the same person's photos the newest is first
  const anon = rankPosts(posts, null, NOW).map(r => r.post.id)
  assert.ok(anon.indexOf('b1') < anon.indexOf('b2') && anon.indexOf('b2') < anon.indexOf('b3'))
})

test('a photo posted before is shown 96% less', () => {
  const same = pic(9)
  const posts = [post('orig', 'x', same, 30), post('copy', 'y', same, 0.1), post('other', 'z', pic(10), 20)]
  const r = rankPosts(posts, 'me', NOW)
  const copy = r.find(x => x.post.id === 'copy')!, orig = r.find(x => x.post.id === 'orig')!
  assert.equal(copy.repost, true); assert.equal(orig.repost, false)
  assert.ok(copy.score < 0.1 * Math.pow(0.5, 0.1 / 36) * 2.5, 'worth about 4% of what it would be')
  assert.equal(r.at(-1)!.post.id, 'copy', 'the copy goes to the bottom, though it is the newest')
  assert.equal(REPOST_WEIGHT, 0.04)
})
