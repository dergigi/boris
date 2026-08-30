import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseFxTwitterThreadPayload, xStatusId } from '../src/services/xThreadService.ts'

test('reconstructs the focal author chain in reply order', () => {
  const payload = JSON.stringify({
    status: {
      id: '100',
      text: 'Opening paragraph.\n\nThread introduction.',
      lang: 'en',
      author: { id: 'author-1', name: 'Example Author', screen_name: 'example' }
    },
    thread: [
      {
        id: 'noise',
        text: 'A side reply must not be read.',
        author: { id: 'other-author', name: 'Other', screen_name: 'other' },
        replying_to: { status: '100' }
      },
      {
        id: '102',
        text: '2/ Second continuation.',
        author: { id: 'author-1' },
        replying_to: { status: '101' }
      },
      {
        id: '101',
        text: '1/ First continuation.',
        author: { id: 'author-1', name: 'Example Author', screen_name: 'example' },
        replying_to: { status: '100' }
      }
    ]
  })

  const content = parseFxTwitterThreadPayload(payload, 'https://x.com/example/status/100')

  assert.equal(content?.title, 'Thread by Example Author (@example)')
  assert.equal(content?.markdown, 'Opening paragraph.\n\nThread introduction.\n\n1/ First continuation.\n\n2/ Second continuation.')
})

test('accepts x.com and twitter.com status URLs only', () => {
  assert.equal(xStatusId('https://x.com/example/status/123'), '123')
  assert.equal(xStatusId('https://twitter.com/example/status/456'), '456')
  assert.equal(xStatusId('https://example.com/status/789'), null)
})

test('prefers readable X Article blocks over thread text', () => {
  const payload = JSON.stringify({
    status: {
      id: '300',
      text: 'Article preview text',
      author: { id: 'author-3', name: 'Writer', screen_name: 'writer' },
      article: {
        title: 'Long-form article',
        content: {
          blocks: [
            { type: 'unstyled', text: 'The article body.' },
            { type: 'unstyled', text: 'A second paragraph.' }
          ]
        }
      }
    },
    thread: [{
      id: '301',
      text: 'This thread text should not win.',
      author: { id: 'author-3' },
      replying_to: { status: '300' }
    }]
  })

  const content = parseFxTwitterThreadPayload(payload, 'https://x.com/writer/status/300')

  assert.equal(content?.title, 'Long-form article')
  assert.equal(content?.markdown, 'The article body.\n\nA second paragraph.')
})

test('rejects malformed payloads without a readable focal status', () => {
  assert.equal(parseFxTwitterThreadPayload('{"status":null}', 'https://x.com/example/status/1'), null)
})
