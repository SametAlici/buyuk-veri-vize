import { TESTS } from '../src/data/tests.ts'
import { WEEKS } from '../src/data/weeks.ts'

let bad = 0
const seen = new Set<string>()
const ids = WEEKS.map((w) => w.id)
TESTS.forEach((t) => {
  if (t.questions.length !== 20) { console.log('SAYI', t.title, t.questions.length); bad++ }
  for (const w of ids) {
    const n = t.questions.filter((q) => q.w === w).length
    if (n !== 4) { console.log('HAFTA DAĞILIMI', t.title, w, n); bad++ }
  }
  t.questions.forEach((q) => {
    if (seen.has(q.q)) { console.log('TEKRAR', q.q); bad++ } seen.add(q.q)
    if (q.o.length !== 4 || new Set(q.o).size !== 4 || q.a < 0 || q.a > 3 || !q.e || !ids.includes(q.w)) { console.log('YAPI', q.q); bad++ }
  })
})
WEEKS.forEach((w) => { if (!w.title || !w.short || !w.principle || w.body.length < 2000) { console.log('HAFTA', w.id); bad++ } })
console.log('Haftalar:', ids.join(','), '· Denemeler:', TESTS.length, '× 20 =', seen.size, 'soru')
console.log(bad ? `${bad} HATA` : 'TÜM KONTROLLER GEÇTİ')
