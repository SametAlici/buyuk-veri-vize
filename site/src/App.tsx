import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Home as HomeIcon, Menu, Moon, PanelLeft, Database, RotateCcw, Sun, Trophy, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { TESTS, WEEKS } from '@/data'
import { useStored } from '@/lib/store'
import { cn } from '@/lib/utils'

const LETTERS = ['A', 'B', 'C', 'D']
type Best = Record<string, number>

// Şıklar her soru için sabit ama karışık sırada (eski siteyle aynı sıra).
function seededOrder(n: number, seed: number) {
  const idx = [...Array(n).keys()]
  let s = seed
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}
const totalQ = TESTS.reduce((s, t) => s + t.questions.length, 0)

const BEGINNER: Record<number, { intro: string; example: string; reflex: string }> = {
  2: {
    intro: 'Bu hafta tek bir bilgisayarın neden yetmediğini ve yetmeden önce ne kadar ileri gidilebileceğini öğreniyorsun. Sorunun çoğu verinin boyunda değil, nasıl saklandığında ve nasıl okunduğunda.',
    example: 'Diskte 2 GB olan CSV bellekte 7 GB olur, çünkü her metin hücresi ayrı bir Python nesnesidir. Aynı veri Parquet’te birkaç yüz MB tutar ve yalnızca istediğin sütunlar okunur.',
    reflex: 'Önce ölç (deep=True), sonra az oku (usecols, sütunlu biçim), sonra küçült (category, downcast). Sıralama ve join gibi işler chunking ile yapılamaz.'
  },
  3: {
    intro: 'Bu hafta birden çok makineyi birlikte çalıştırmanın bedelini öğreniyorsun: ağ güvenilmez, makineler bozulur, saatler kayar ve bölünmede tutarlılık ile erişilebilirlik birlikte sağlanamaz.',
    example: 'Bir ödeme isteğine cevap gelmediğinde istek mi kayboldu, cevap mı kayboldu bilemezsin. Tekrar gönderirsen iki kez ödeme yapabilirsin; bu yüzden işlemler idempotent tasarlanır.',
    reflex: 'Bölünme anında C mi A mı? W + R > N mi? Çoğunluk için düğüm sayısı tek mi? Çoğaltma yedek değildir.'
  },
  4: {
    intro: 'Bu hafta büyük dosyaların birçok makineye nasıl dağıtıldığını öğreniyorsun. HDFS dosyayı bloklara böler, blokları üç kopya hâlinde DataNode’lara koyar; nerede ne olduğunu NameNode bilir.',
    example: 'NameNode bir santral gibidir: kimin nerede olduğunu söyler ama konuşma onun üzerinden geçmez. Bulutta aynı rolü nesne deposu (S3) üstlenir; orada da listeleme ve yeniden adlandırma pahalıdır.',
    reflex: 'Veri NameNode’dan geçmez · küçük dosya NameNode belleğini yer · 1 + 2 raf yerleşimi · nesne deposunda atomik rename yok → tablo biçimleri.'
  },
  5: {
    intro: 'Bu hafta veriyi programa değil, programı veriye götürmeyi öğreniyorsun. MapReduce işi her makinede yerel çalışan map, anahtara göre karıştıran shuffle ve birleştiren reduce adımlarına böler.',
    example: 'Kelime saymada her makine kendi kelimelerini sayar (combiner), yalnızca küçük ara toplamlar ağa çıkar. Çok sık bir kelime tek reduce görevine yığılırsa bütün iş onu bekler (çarpıklık).',
    reflex: 'Shuffle en pahalı adımdır · combiner yalnız toplanabilir işlemde güvenli · küçük tabloyu yayınla · aşama en yavaş görev kadar sürer.'
  },
  6: {
    intro: 'Bu hafta Spark’ın işleri nasıl planladığını öğreniyorsun. Dönüşümler yalnızca tarif yazar; bir eylem gelince Spark tarifin tamamını görür, optimize eder ve aşamalara bölerek çalıştırır.',
    example: 'filter + withColumn + groupBy yazdın, hiçbir şey olmadı. count() dediğinde Spark filtreyi okumaya kadar indirdi, gereksiz sütunları atladı ve tek bir shuffle ile işi iki aşamada bitirdi.',
    reflex: 'Dönüşüm ↔ eylem · dar ↔ geniş bağımlılık · aşama = shuffle + 1 · Python UDF Catalyst’e kara kutu · cache yalnız tekrar kullanılırsa.'
  }
}

function A({ to, className, children, onClick }: { to: string; className?: string; children: React.ReactNode; onClick?: () => void }) {
  return <a href={`#${to}`} className={className} onClick={onClick}>{children}</a>
}
const go = (to: string) => () => { location.hash = to }

function Nav({ current, onGo }: { current: string; onGo?: () => void }) {
  const [done] = useStored<number[]>('bv-done', [])
  const [best] = useStored<Best>('bv-best', {})
  const item = (on: boolean) => cn('flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors', on ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')
  return (
    <nav className="grid gap-0.5 p-3">
      <A to="home" onClick={onGo} className={item(current === 'home')}><HomeIcon className="mt-0.5 size-4" />Ana sayfa</A>
      <div className="mt-4 mb-1 px-2.5 text-xs font-medium text-muted-foreground">Haftalar</div>
      {WEEKS.map((w) => (
        <A key={w.id} to={`hafta-${w.id}`} onClick={onGo} className={item(current === `hafta-${w.id}`)}>
          <span className="w-4 shrink-0 font-mono text-[11px] leading-5 opacity-70">{w.id}</span><span className="min-w-0 flex-1 leading-5">{w.title}</span>{done.includes(w.id) && <Check className="mt-0.5 size-3.5 shrink-0" />}
        </A>
      ))}
      <div className="mt-4 mb-1 px-2.5 text-xs font-medium text-muted-foreground">Vize denemeleri</div>
      <A to="denemeler" onClick={onGo} className={item(current === 'denemeler')}><ClipboardList className="mt-0.5 size-4" />Tüm denemeler</A>
      {TESTS.map((t, i) => (
        <A key={i} to={`deneme-${i + 1}`} onClick={onGo} className={item(current === `deneme-${i + 1}`)}>
          <span className="w-6 shrink-0 font-mono text-[11px] leading-5 opacity-70">D{i + 1}</span><span className="flex-1 leading-5">{t.title}</span>{best[i + 1] !== undefined && <span className="font-mono text-[11px] leading-5">{best[i + 1]}/{t.questions.length}</span>}
        </A>
      ))}
    </nav>
  )
}

function Home() {
  const [done] = useStored<number[]>('bv-done', [])
  return (
    <div className="mx-auto max-w-4xl">
      <Badge variant="secondary">BSM 461 · Sakarya Üniversitesi</Badge>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Büyük Veriye Giriş vize rehberi</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">2–6. haftaların ders notlarından hazırlanmış özetler, vakalar ve yorum ağırlıklı {TESTS.length} vize denemesi ({totalQ} soru). Her haftayı bitirince işaretle; ilerlemen bu tarayıcıda saklanır. (1. haftanın PDF’i elimde olmadığı için site 2. haftadan başlıyor.)</p>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={go('hafta-2')}>2. haftadan başla<ArrowRight /></Button><Button variant="outline" onClick={go('denemeler')}>Denemeler</Button></div>
      <div className="mt-6 rounded-lg border p-3"><div className="mb-2 flex justify-between text-sm"><span>İlerleme</span><span className="font-mono text-xs">{done.length} / {WEEKS.length} hafta</span></div><Progress value={(done.length / WEEKS.length) * 100} /></div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Haftalar</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WEEKS.map((w) => (
          <A key={w.id} to={`hafta-${w.id}`} className="group"><Card className="h-full transition-colors group-hover:border-foreground/30"><CardHeader>
            <CardDescription className="flex items-center gap-1 font-mono text-xs">HAFTA {w.id}{done.includes(w.id) && <Check className="size-3" />}</CardDescription>
            <CardTitle className="text-base">{w.title}</CardTitle><CardDescription>{w.short}</CardDescription>
          </CardHeader></Card></A>
        ))}
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">En verimli çalışma sırası</h2>
      <ol className="ml-5 list-decimal space-y-1 text-sm leading-relaxed">
        <li>Her haftanın ilkesini ve “Önce bunu anla” kutusunu oku; sonra ayrıntıya geç.</li>
        <li>Rakamları ezberleme, ne anlattıklarını anla: “neden yavaşladı?”, “hangisini seçerdin?”, “bu ölçüm neyi gösterir?” sorularına cevap verebilmelisin.</li>
        <li>Her deneme 5 haftadan 4’er soru içerir ve hepsi yorum ağırlıklıdır; hesap makinesi gerekmez.</li>
        <li>Yanlış yaptığın sorunun açıklamasını oku, sonra o haftanın ilgili bölümüne dön.</li>
      </ol>
      <div className="lesson"><div className="box tip"><span className="label">Sınavda en çok karıştırılanlar</span>memory_usage ↔ deep=True · Parquet hızı az sütun istemekten gelir, SELECT * kazancı yok eder · gzip’li CSV bölünemez, Parquet içindeki gzip bölünebilir · Çoğaltma ≠ yedek · CA diye seçenek yok · Çift sayıda Raft düğümü kazanç getirmez · Veri NameNode’dan geçmez · Küçük dosyanın bedeli NameNode belleğinde · Ortalamada combiner (toplam, adet) gönderir, ortancada kullanılamaz · Aşama sayısı = shuffle + 1 · cache tek kullanımda zarardır.</div></div>
    </div>
  )
}

function WeekPage({ id }: { id: number }) {
  const w = WEEKS.find((x) => x.id === id)
  const [done, setDone] = useStored<number[]>('bv-done', [])
  if (!w) return <Home />
  const isDone = done.includes(id), prev = WEEKS.find((x) => x.id === id - 1), next = WEEKS.find((x) => x.id === id + 1)
  return (
    <div className="mx-auto max-w-3xl">
      <Badge variant="secondary">Hafta {w.id}</Badge>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{w.title}</h1>
      <div className="lesson">
        <div className="box key"><span className="label">Haftanın ilkesi</span>{w.principle}</div>
        <div className="box tip">
          <span className="label">Önce bunu anla</span>
          <p><b>Basit anlatım:</b> {BEGINNER[id]?.intro}</p>
          <p><b>Günlük hayat örneği:</b> {BEGINNER[id]?.example}</p>
          <p><b>Sınav refleksi:</b> {BEGINNER[id]?.reflex}</p>
        </div>
      </div>
      <div className="lesson" dangerouslySetInnerHTML={{ __html: w.body }} />
      <Button className="mt-6" variant={isDone ? 'secondary' : 'default'} onClick={() => setDone(isDone ? done.filter((x) => x !== id) : [...done, id])}><Check />{isDone ? 'Tamamlandı (geri al)' : 'Bu haftayı tamamladım'}</Button>
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        {prev ? <Button variant="outline" onClick={go(`hafta-${prev.id}`)}><ArrowLeft />Hafta {prev.id}</Button> : <span />}
        {next ? <Button onClick={go(`hafta-${next.id}`)}>Hafta {next.id}<ArrowRight /></Button> : <Button onClick={go('denemeler')}>Vize denemelerine geç<ArrowRight /></Button>}
      </div>
    </div>
  )
}

function TestList() {
  const [best] = useStored<Best>('bv-best', {})
  return (
    <div className="mx-auto max-w-3xl">
      <Badge variant="secondary">Vize denemeleri</Badge>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{TESTS.length} deneme, {totalQ} soru</h1>
      <p className="mt-1 text-muted-foreground">Önce soruyu kendin çöz. Şıkkı seçince doğru cevap, kısa gerekçe ve tekrar etmen gereken haftayı görebilirsin.</p>
      <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <b>Deneme formatı:</b> Her deneme 20 soru; 2–6. haftalardan 4’er soru. Sorular ezber değil yorum ölçer: bir ölçüm, bir hata ya da bir tasarım kararı verilir, en doğru yorumu seçersin. Hesap makinesi gerekmez.
      </div>
      <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <b>Deneme taktiği:</b> Önce sorunun hangi konuyu ölçtüğünü bul → bildiğin formülü/kurala yaz → şıkları ele → sonra cevabı işaretle. Yanlışsa sadece cevabı ezberleme; açıklamadaki “neden” kısmını oku.
      </div>
      <div className="mt-5 grid gap-2">
        {TESTS.map((t, i) => (
          <A key={i} to={`deneme-${i + 1}`} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium">{t.title} <span className="font-normal text-muted-foreground">· {t.questions.length} soru</span></div><div className="text-xs text-muted-foreground">{t.desc}</div></div>
            {best[i + 1] !== undefined ? <Badge variant="outline"><Trophy />{best[i + 1]}/{t.questions.length}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
          </A>
        ))}
      </div>
    </div>
  )
}

function TestRun({ n }: { n: number }) {
  const t = TESTS[n - 1]
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [best, setBest] = useStored<Best>('bv-best', {})
  useEffect(() => { setAnswers({}) }, [n])
  if (!t) return <TestList />
  const total = t.questions.length, answered = Object.keys(answers).length
  const correct = Object.entries(answers).filter(([q, a]) => t.questions[+q].a === a).length
  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== undefined) return
    const next = { ...answers, [qi]: oi }
    setAnswers(next)
    if (Object.keys(next).length === total) {
      const c = Object.entries(next).filter(([q, a]) => t.questions[+q].a === a).length
      if (best[n] === undefined || c > best[n]) setBest({ ...best, [n]: c })
    }
  }
  const wrongWeeks = [...new Set(t.questions.filter((q, i) => answers[i] !== q.a).map((q) => q.w))].sort((a, b) => a - b)
  return (
    <div className="mx-auto max-w-3xl">
      <Badge variant="secondary">Vize denemesi {n}</Badge>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.desc} · {total} soru</p>
      <div className="sticky top-14 z-20 my-4 flex items-center gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur">
        <Badge variant="outline">{answered} / {total}</Badge><Badge variant="outline">Doğru: {correct}</Badge>
        <Progress className="flex-1" value={(answered / total) * 100} />
        <Button size="sm" variant="ghost" onClick={() => setAnswers({})}><RotateCcw />Baştan</Button>
      </div>
      <div className="space-y-3">
        {t.questions.map((q, qi) => {
          const a = answers[qi]
          return (
            <div key={qi} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs leading-6 text-muted-foreground">{qi + 1}.</span>
                <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: q.q }} />
                <Badge variant="outline" className="shrink-0">Hafta {q.w}</Badge>
              </div>
              <div className="mt-2 grid gap-1.5">
                {seededOrder(q.o.length, n * 100 + qi + 7).map((oi, pos) => (
                  <button key={oi} disabled={a !== undefined} onClick={() => choose(qi, oi)}
                    className={cn('flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors enabled:hover:bg-accent',
                      a !== undefined && oi === q.a && 'border-emerald-500 bg-emerald-500/10', a === oi && oi !== q.a && 'border-red-500 bg-red-500/10')}>
                    <span className="font-mono text-xs text-muted-foreground">{LETTERS[pos]}</span><span className="flex-1" dangerouslySetInnerHTML={{ __html: q.o[oi] }} />
                    {a !== undefined && oi === q.a && <Check className="size-4 shrink-0 text-emerald-600" />}{a === oi && oi !== q.a && <X className="size-4 shrink-0 text-red-600" />}
                  </button>
                ))}
              </div>
              {a !== undefined && (
                <div className="rise mt-2 rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                  <p><b>{a === q.a ? '✓ Doğru.' : '✗ Yanlış.'}</b></p>
                  <p className="mt-1"><b>Neden?</b> <span dangerouslySetInnerHTML={{ __html: q.e }} /></p>
                  <p className="mt-1 text-muted-foreground"><b>Tek cümlelik kural:</b> Sorudaki kavramı kendi cümlenle tekrar et; örneğin “etiket yoksa ve normalden farklı kayıt aranıyorsa anomali” gibi.</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {answered === total && (
        <Card className="mt-5"><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-5" />{correct} / {total}</CardTitle><CardDescription>Puan: {Math.round((correct / total) * 100)}</CardDescription></CardHeader>
          <CardContent className="text-sm">{wrongWeeks.length ? <>Tekrar etmen önerilen haftalar: {wrongWeeks.map((w, i) => <span key={w}>{i > 0 && ' · '}<A to={`hafta-${w}`} className="underline">Hafta {w}</A></span>)}</> : 'Hepsi doğru, tebrikler!'}</CardContent></Card>
      )}
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={go(n > 1 ? `deneme-${n - 1}` : 'denemeler')}><ArrowLeft />{n > 1 ? `Deneme ${n - 1}` : 'Tüm denemeler'}</Button>
        <Button onClick={go(n < TESTS.length ? `deneme-${n + 1}` : 'denemeler')}>{n < TESTS.length ? `Deneme ${n + 1}` : 'Tüm denemeler'}<ArrowRight /></Button>
      </div>
    </div>
  )
}

export default function App() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || 'home')
  const [theme, setTheme] = useStored<string | null>('bv-theme', null)
  const [open, setOpen] = useStored('bv-sidebar', true)
  const [drawer, setDrawer] = useState(false)
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  useEffect(() => { const on = () => { setHash(location.hash.slice(1) || 'home'); setDrawer(false); window.scrollTo(0, 0) }; window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on) }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  const page = hash.startsWith('hafta-') ? <WeekPage key={hash} id={Number(hash.split('-')[1])} /> : hash.startsWith('deneme-') ? <TestRun key={hash} n={Number(hash.split('-')[1])} /> : hash === 'denemeler' ? <TestList /> : <Home />
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
        <Button size="icon" variant="ghost" className="lg:hidden" aria-label="Menü" onClick={() => setDrawer(true)}><Menu /></Button>
        <Button size="icon" variant="ghost" className="hidden lg:inline-flex" aria-label="Kenar çubuğu" onClick={() => setOpen(!open)}><PanelLeft /></Button>
        <a href="#home" className="flex items-center gap-2 font-semibold tracking-tight"><Database className="size-4" />Büyük Veri</a>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" aria-label="Tema" onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <Sun /> : <Moon />}</Button>
      </header>
      <div className="flex">
        <aside className={cn('sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r transition-[width] lg:block', open ? 'w-72' : 'w-0 border-r-0')}><div className="w-72"><Nav current={hash} /></div></aside>
        <Sheet open={drawer} onOpenChange={setDrawer}><SheetContent side="left" className="w-80 overflow-y-auto p-0"><SheetTitle className="px-5 pt-5">Menü</SheetTitle><Nav current={hash} onGo={() => setDrawer(false)} /></SheetContent></Sheet>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{page}</main>
      </div>
    </div>
  )
}
