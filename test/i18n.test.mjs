import { test } from 'node:test'
import assert from 'node:assert'
import { resolveLang, t } from '../src/renderer/src/i18n.js'

test('system language picks Arabic only for Arabic locales', () => {
  assert.equal(resolveLang('system', 'ar'), 'ar')
  assert.equal(resolveLang('system', 'ar-SA'), 'ar')
  assert.equal(resolveLang('system', 'en-US'), 'en')
  assert.equal(resolveLang(undefined, 'fr'), 'en')
  assert.equal(resolveLang('en', 'ar-EG'), 'en')
  assert.equal(resolveLang('ar', 'en-US'), 'ar')
})

test('Arabic counted nouns use the right form, with Western digits', () => {
  assert.equal(t('ar', 'filesLabel', 1), 'ملف واحد')
  assert.equal(t('ar', 'filesLabel', 2), 'ملفان')
  assert.equal(t('ar', 'filesLabel', 3), '3 ملفات')
  assert.equal(t('ar', 'filesLabel', 10), '10 ملفات')
  assert.equal(t('ar', 'filesLabel', 11), '11 ملفًا')
  assert.equal(t('en', 'filesLabel', 2), '2 files')
})

test('unknown keys fall back to English, then to the key itself', () => {
  assert.equal(t('ar', 'Item not found'), 'العنصر غير موجود')
  assert.equal(t('ar', 'Some system error'), 'Some system error')
})

test('English counts use the singular for one', () => {
  assert.equal(t('en', 'charsLabel', 1), '1 char')
  assert.equal(t('en', 'charsLabel', 12), '12 chars')
  assert.equal(t('en', 'results', 1), '1 result')
  assert.equal(t('en', 'removeWarn', 1), '1 item will be deleted. Click again to confirm.')
  assert.equal(t('en', 'removeWarn', 3), '3 items will be deleted. Click again to confirm.')
})
