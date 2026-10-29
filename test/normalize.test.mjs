import { test } from 'node:test'
import assert from 'node:assert'
import { normalize, removeDiacritics, westernDigits } from '../src/renderer/src/normalize.js'

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

test('westernDigits turns Arabic-Indic and Persian digits into 0-9 and leaves the rest', () => {
  assert.equal(westernDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ abc 42'), '0123456789 0123456789 abc 42')
})

test('removeDiacritics drops tashkeel and tatweel but keeps hamza forms', () => {
  assert.equal(removeDiacritics('مُحَمَّـد أَحْمَد'), 'محمد أحمد')
  assert.equal(removeDiacritics('دفع ١٢٣٤٥ ريالًا'), 'دفع ١٢٣٤٥ ريالا')
})

test('normalize treats taa marbuta and haa as the same letter', () => {
  assert.equal(normalize('السعودية'), normalize('السعوديه'))
})
