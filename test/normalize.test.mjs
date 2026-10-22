import { test } from 'node:test'
import assert from 'node:assert'
import { normalize } from '../src/renderer/src/normalize.js'

const finds = (text, query) => normalize(text).includes(normalize(query))

test('Arabic search ignores diacritics, hamza forms and alef maqsura', () => {
  assert.ok(finds('هل جرّبت الميزة الجديدة؟', 'جربت'))
  assert.ok(finds('قمت بتثبيت الإصدار 45', 'الاصدار'))
  assert.ok(finds('أحمد', 'احمد'))
  assert.ok(finds('على الطاولة', 'علي'))
  assert.ok(finds('مـــرحبا', 'مرحبا'))
  assert.ok(!finds('مرحبا', 'وداعا'))
})

test('Latin search stays case-insensitive', () => {
  assert.ok(finds('Electron on Windows', 'windows'))
})
