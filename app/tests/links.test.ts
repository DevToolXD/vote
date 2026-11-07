import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitLinks } from '../src/linkText'

test('a web address in the text becomes a link, the rest stays text', () => {
  assert.deepEqual(splitLinks('보세요 https://www.youtube.com 끝'), [
    { text: '보세요 ' }, { text: 'https://www.youtube.com', href: 'https://www.youtube.com' }, { text: ' 끝' },
  ])
})

test('www. links open as https, and sentence punctuation is left out of the link', () => {
  assert.deepEqual(splitLinks('www.naver.com.'), [{ text: 'www.naver.com', href: 'https://www.naver.com' }, { text: '.' }])
  assert.deepEqual(splitLinks('(https://a.kr/x?y=1)'), [{ text: '(' }, { text: 'https://a.kr/x?y=1', href: 'https://a.kr/x?y=1' }, { text: ')' }])
})

test('only http and https are linked; plain text and a bare "www." are not', () => {
  assert.deepEqual(splitLinks('javascript:alert(1) 그냥 글'), [{ text: 'javascript:alert(1) 그냥 글' }])
  assert.deepEqual(splitLinks('www. 만'), [{ text: 'www. 만' }])
  assert.deepEqual(splitLinks(''), [])
})

test('two links in one message', () => {
  const p = splitLinks('a https://x.com b http://y.org')
  assert.deepEqual(p.filter(x => x.href).map(x => x.href), ['https://x.com', 'http://y.org'])
})
