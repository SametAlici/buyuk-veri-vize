// Haftalık özetler: BSM 461 Büyük Veriye Giriş, H02–H06 ders notları ve detay belgelerinden.
// Bütün sayılar ders notlarındaki ölçüm ve hesaplardan alındı.
import type { Week } from './types'

export const WEEKS: Week[] = [
{
  id: 2,
  title: 'Tek Makinenin Sınırı: Bellek, Biçim, Sütunlu Depolama',
  short: 'Python nesne yükü, object ↔ category, tip daraltma, chunking, CSV\'nin dört kusuru, Parquet anatomisi, pushdown, kodek ve bölünebilirlik.',
  principle: 'Araçlar eskir, biçimler kalır. Aynı donanımda, yalnız veriyi nasıl sakladığınızı değiştirerek 15 kat hızlanabilirsiniz.',
  body: `
<div class="box tip"><span class="label">Haftanın verisi</span><code>satis.csv</code>: 16 milyon satır, diskte 516 MB, beş sütun (<code>id, urun_id, bolge, adet, tutar</code>). Bütün sayılar bu dosyadan, Apple M4 üzerinde ölçüldü. Sayılar makineye göre değişir, <b>oranlar</b> benzer kalır.</div>

<h2>1. 516 MB'lık CSV bellekte neden 1.577 MB oldu?</h2>
<div class="table-wrap"><table>
<tr><th>Neyi saklıyoruz</th><th>Bayt</th></tr>
<tr><td>CSV'de metin olarak 1234567</td><td>7</td></tr>
<tr><td>NumPy int64 elemanı</td><td>8</td></tr>
<tr><td>NumPy int8 elemanı</td><td>1</td></tr>
<tr><td>Python int nesnesi</td><td>28 (24'ü muhasebe, 4'ü veri)</td></tr>
<tr><td>Python str "Ege" / "Doğu"</td><td>44 / 66</td></tr>
</table></div>
<p>Python'da her değer bir nesnedir: referans sayacı, tip işaretçisi, boyut alanı ve en sonda değerin kendisi. Liste yalnızca nesnelerin adresini tutar. pandas sayıları NumPy dizisinde bitişik 8'er bayt tuttuğu için <b>sayısal sütunlar sorun değildir</b>.</p>
<div class="formula">4 sayısal sütun × 8 B × 16 M = 512 MB
bolge (object): (58,6 B metin + 8 B işaretçi) × 16 M = 1.065 MB
Toplam = 1.577 MB → diskin 3,1 katı; %68'i tek bir metin sütunu</div>
<div class="box key"><span class="label">object dtype = "bilinmeyen tip"</span>pandas o sütunu anlamaz, her satır için ayrı bir Python metin nesnesi tutar. Yedi farklı değer, ama 16 milyon nesne. Bellek şişmesinin neredeyse her zaman sebebi budur. Türkçe karakter (ğ, İ, ü) dizenin daha geniş gösterime geçmesine yol açar: "Doğu" 4 karakter ama 66 bayt.</div>
<p><b>deep=True şart:</b> <code>memory_usage()</code> onsuz yalnız işaretçileri sayar ve bolge için 128 MB der; sorunu hiç göstermez.</p>

<h2>2. Çözümler: category, tip daraltma, chunking</h2>
<div class="table-wrap"><table>
<tr><th>Hamle</th><th>Ne yapar</th><th>Sonuç</th></tr>
<tr><td><b>category</b></td><td>Farklı değerleri bir kez sözlükte, satırlarda yalnız kodu tutar</td><td>bolge 1.065 MB → 16 MB (67 kat)</td></tr>
<tr><td><b>Tip daraltma</b></td><td>adet → int8, urun_id → int16, id → int32, tutar → float32</td><td>1.577 MB → 192 MB (8,2 kat), diskten bile küçük</td></tr>
<tr><td><b>usecols</b></td><td>Gereksiz sütunu hiç okumaz</td><td>Önce oku-seç değil, okurken seç</td></tr>
</table></div>
<div class="box warn"><span class="label">İki istisna</span><b>category zararlı olabilir:</b> benzersiz değer sayısı satır sayısına yaklaşıyorsa (müşteri adı) sözlük de büyür. Kaba ölçüt: <code>nunique/len &lt; 0,5</code>. <b>float32 riskli olabilir:</b> ~7 anlamlı basamak; milyarlarca satırın parasal toplamında yuvarlama hatası birikir. Parada float64 ya da kuruş cinsinden int64.</div>
<h3>Chunking (parça parça işleme)</h3>
<p>Dosyayı 1 milyon satırlık parçalarla okumak toplam için yeter (2,4 s, bellekte hiçbir zaman 1 M satırdan fazlası durmaz). Ama her iş için değil:</p>
<div class="table-wrap"><table>
<tr><th>İşlem</th><th>Chunking yeter mi?</th><th>Neden</th></tr>
<tr><td>Toplam, sayım, ortalama, filtre</td><td>✅</td><td>Parçaların sonucu biriktirilebilir, satırlar bağımsız</td></tr>
<tr><td>Az gruplu groupBy</td><td>✅</td><td>Grup sonuçları küçük</td></tr>
<tr><td>Milyonlarca gruplu groupBy</td><td>⚠️</td><td>Ara tablo belleği doldurabilir</td></tr>
<tr><td>Sıralama · join · nunique</td><td>❌</td><td>Anahtarın tamamını bir arada görmek gerekir</td></tr>
</table></div>
<div class="box key"><span class="label">Konuma göre ↔ değere göre bölmek</span>Chunking veriyi <b>konuma</b> göre keser: ilk 4 M satırda 5.000 ürünün hepsi görünür ama hiçbiri eksiksiz değildir. <b>Hash bölümleme</b> değere göre keser: kovada az ürün (1.276) vardır ama her biri eksiksizdir. DuckDB/Polars sıralamayı <i>dıştan birleştirmeli sıralama</i>, join'i <i>bölümlenmiş hash join</i> ile yapar: "bölümle → ayrı işle → birleştir". Veriyi anahtara göre yeniden dağıtmanın adı <b>shuffle</b>'dır: tek makinede kovalar diske yazılır, kümede ağdan geçer.</div>

<h2>3. CSV'nin dört kusuru</h2>
<ol>
<li><b>Tip yok:</b> her şey metin; okuyan program tahmin eder, yanılabilir.</li>
<li><b>Şema yok:</b> sütun sırası değişirse eski kod sessizce yanlış sütunu okur.</li>
<li><b>Ayrıştırma pahalı:</b> "1234.56" her okumada karakter karakter sayıya çevrilir: 16 M × 5 = 80 milyon dönüştürme. Parquet'te bu adım hiç yoktur.</li>
<li><b>Sıkıştırılınca bölünemez:</b> gzip'in sözlüğü dosya boyunca birikir; ortadaki baytı çözmek için öncekilerin hepsini çözmek gerekir. satis.csv.gz 163 MB'a indi ama sorgu 0,324 s → 1,08 s, yani <b>3,3 kat yavaşladı</b> (çözme + paralellik kaybı).</li>
</ol>

<h2>4. Parquet anatomisi</h2>
<div class="table-wrap"><table>
<tr><th>Katman</th><th>Nedir</th><th>Niye var</th></tr>
<tr><td>Row group</td><td>Satırların yatay dilimi (~1 M satır / 128 MB)</td><td>Bağımsız okunur → <b>bölünebilirlik</b>, paralellik</td></tr>
<tr><td>Column chunk</td><td>Row group içindeki tek sütun</td><td>İstenmeyen sütun hiç okunmaz → <b>projection pushdown</b></td></tr>
<tr><td>Page</td><td>~1 MB'lık kodlama/sıkıştırma birimi</td><td>Her page ayrı sıkıştırılır, bağımsızdır</td></tr>
<tr><td>Footer</td><td>Şema + her row group'un her sütunu için min/max + konum</td><td>Atlanacak blok buradan bilinir → <b>predicate pushdown</b>. Dosya sondan okunur (ilk ve son 4 bayt <code>PAR1</code>)</td></tr>
</table></div>
<p>Dönüştürme bir "sıkıştırma" değil, <b>yeniden düzenleme</b>dir: tip verilir, sütunlara ayrılır, kodlanır, bölümlenir, istatistik yazılır; sıkıştırma bunların üstüne biner.</p>
<div class="table-wrap"><table>
<tr><th>Kodlama</th><th>Nasıl</th><th>Örnek</th></tr>
<tr><td>Dictionary</td><td>Farklı değerler sözlükte, satırda numara</td><td>bolge: 7 değer → satır başına 0,38 bayt</td></tr>
<tr><td>RLE</td><td>Ardışık tekrar "değer × sayı"</td><td>Sıralı veride çok etkili</td></tr>
<tr><td>Delta</td><td>Önceki değerden fark</td><td>id: 1, 2, 3 → hep +1</td></tr>
</table></div>
<div class="box key"><span class="label">Az çeşit → çok kazanç</span>tutar'da 199.001 farklı değer var; sözlük veri kadar büyüyeceği için Parquet sözlükten kendiliğinden vazgeçer (PLAIN). Sıkışma oranı verinin özelliğidir, biçimin değil. Aynı fikir iki yerde: diskte <i>dictionary encoding</i>, bellekte <i>category</i>.</div>
<div class="box warn"><span class="label">İstatistik ancak veri düzenliyse işe yarar</span><code>WHERE id &gt; 15.000.000</code>: veri id'ye göre sıralı yazıldığı için 130 grubun 121'i atlanır (%93 okunmaz). tutar ve bolge ise dosya boyunca rastgele; her grubun min–max aralığı aynı, <b>hiçbir grup atlanamaz</b>. Çözüm: sık filtrelenen sütuna göre sıralı ya da bölümlenmiş yazmak.</div>

<h2>5. Pushdown: ölçülmüş kazanç</h2>
<p><b>Projection pushdown (sütun itme):</b> yalnız gereken sütunlar okunur. <b>Predicate pushdown (koşul itme):</b> WHERE'e uymayan bloklar hiç okunmaz. "İtme" adı plan ağacından gelir: filtre yukarıdan, veriye en yakın yere (okumaya) itilir.</p>
<div class="table-wrap"><table>
<tr><th>Sorgu</th><th>CSV (516 MB)</th><th>Parquet (185 MB)</th></tr>
<tr><td>Bölgeye göre ciro</td><td>0,324 s</td><td>0,022 s → <b>15 kat</b></td></tr>
<tr><td>Aynı Parquet'te <code>SELECT *</code></td><td colspan="2">4,85 s → doğru sorgunun <b>220 katı</b>; CSV'den bile yavaş</td></tr>
</table></div>
<div class="box warn"><span class="label">Haftanın tuzağı: "Parquet'e geçtim, hızlanmadı"</span>Sebep neredeyse her zaman <code>SELECT *</code> ya da tüm dosyayı okuyan <code>pd.read_parquet(dosya)</code>'dır. Sütunlu biçimin sözleşmesi: <b>ne kadar az sütun istersen o kadar hızlıyım.</b></div>

<h2>6. Kodek ve bölünebilirlik</h2>
<div class="table-wrap"><table>
<tr><th>Kodek</th><th>Dosya</th><th>Yazma</th><th>Sorgu</th></tr>
<tr><td>snappy (varsayılan)</td><td>185 MB</td><td>0,6 s</td><td>0,021 s · en hızlı okuma</td></tr>
<tr><td>zstd</td><td>112 MB</td><td>0,6 s</td><td>0,026 s · en küçük</td></tr>
<tr><td>gzip</td><td>117 MB</td><td>2,1 s</td><td>0,038 s</td></tr>
</table></div>
<p>zstd gzip'i her yönden geçti ("gzip en çok sıkıştırır" sezgisi bugün yanlış). Fark sorguda küçük, depolamada büyük; bulutta depolama parayla ölçüldüğü için zstd çoğu zaman kazanır.</p>
<div class="box key"><span class="label">Aynı algoritma, iki farklı kap</span>gzip'li CSV tek uzun akıştır: ne bölünür ne atlanır. Parquet+gzip yüzlerce bağımsız page'dir ve footer her row group'un kaçıncı bayttan başladığını yazar: hem bölünebilir hem daha küçük (117 ↔ 163 MB). Kötü olan gzip değil, <b>gzip'li CSV</b>'dir. İkisi birden gerekir: bağımsız paketler ve dizin.</div>

<h2>7. Karar kuralı ve başabaş</h2>
<div class="table-wrap"><table>
<tr><th>Durum</th><th>Biçim</th></tr>
<tr><td>Bir kez okunup atılacak</td><td>CSV kalsın</td></tr>
<tr><td>Defalarca sorgulanacak / boru hattı çıktısı</td><td>Parquet</td></tr>
<tr><td>İnsan gözüyle açılacak, başka sisteme aktarım</td><td>CSV / JSON</td></tr>
<tr><td>Depolama maliyeti kritik · sık okunan sıcak veri</td><td>Parquet + zstd · Parquet + snappy</td></tr>
</table></div>
<div class="formula">CSV: 0,324·N    Parquet: 0,6 + 0,022·N    →  N = 0,6 ÷ 0,302 ≈ 2 soru</div>
<p>N satır sayısı değil, <b>kaç kez soru sorduğunuz</b>dur. Pratikte N neredeyse hiç 1 olmaz: "tek okuma sandığınız iş genelde tek okuma değildir."</p>

<h2>Vaka: Parquet nereden çıktı?</h2>
<p>2012–13'te Twitter (Hadoop'ta petabaytlarca log, her sorgu gereksiz sütunları okuyordu) ve Cloudera (Impala için sütunlu biçim) ortak proje başlattı; Google'ın <b>Dremel</b> (2010) makalesindeki iç içe veriyi sütunlara ayırma fikrini temel aldılar. Parquet 1.0 Temmuz 2013, Apache üst düzey proje 2015. Ders: <b>araçlar eskir, biçimler kalır</b>; biçim kararı araç kararından önemlidir.</p>

<h2>Belirti → tanı</h2>
<div class="table-wrap"><table>
<tr><th>Belirti</th><th>Tanı</th><th>Hamle</th></tr>
<tr><td>Dosya küçük, RAM doldu</td><td>object dtype</td><td>category + tip daraltma</td></tr>
<tr><td>Parquet'e geçtim, hızlanmadı</td><td>SELECT *</td><td>Yalnız gereken sütunlar</td></tr>
<tr><td>gzip'li dosyayı tek görev okuyor</td><td>Bölünemez kodek</td><td>Parquet'e çevir</td></tr>
<tr><td>Parquet'te WHERE hızlanmıyor</td><td>Veri rastgele sıralı, istatistik işe yaramıyor</td><td>Filtre sütununa göre sıralı yaz</td></tr>
<tr><td>float toplamı tutmuyor</td><td>float32 yuvarlaması</td><td>float64 / kuruş int64</td></tr>
</table></div>
`
},
{
  id: 3,
  title: 'Dağıtık Sistemlerin Dört Acı Gerçeği',
  short: 'Sekiz yanılgı, arıza normaldir, kısmi arıza, aralık/hash/tutarlı hash, sıcak nokta, çoğaltma, quorum, CAP–PACELC, Raft, saatler.',
  principle: 'Tek makinede "yavaş" olan şey, kümede "yanlış" olabilir. Arıza bir istisna değil, normal çalışma durumudur.',
  body: `
<h2>1. Sekiz yanılgı (Deutsch, Sun, 1994)</h2>
<div class="table-wrap"><table>
<tr><th>Yanılgı</th><th>Gerçekte</th><th>Koda yansıması</th></tr>
<tr><td>Ağ güvenilirdir</td><td>Paket kaybolur</td><td>Zaman aşımı, hata yakalama yazılmaz</td></tr>
<tr><td><b>Gecikme sıfırdır</b></td><td>Veri merkezi ~0,5 ms, kıtalar arası ~150 ms</td><td>Döngü içinde ağ çağrısı</td></tr>
<tr><td>Bant genişliği sonsuzdur</td><td>Paylaşılan ve sınırlı</td><td>"Hepsini çekip yerelde işlerim"</td></tr>
<tr><td>Ağ güvenlidir</td><td>Değil</td><td>Şifresiz iç trafik</td></tr>
<tr><td>Topoloji değişmez</td><td>Düğüm eklenir, ölür</td><td>Sabit IP listesi</td></tr>
<tr><td>Tek yönetici vardır</td><td>Farklı ekipler, sürümler</td><td>"Herkes aynı anda güncellenir"</td></tr>
<tr><td>Taşıma maliyeti sıfırdır</td><td>Serileştirme + ağ + çözme</td><td>Gereksiz veri gönderme</td></tr>
<tr><td>Ağ homojendir</td><td>Farklı donanım, hız</td><td>En yavaş halka görülmez</td></tr>
</table></div>
<p>İkincisi en pahalısı: RAM erişimi 100 ns, kıtalar arası gidiş-dönüş 150 ms → 1,5 milyon kat.</p>

<h2>2. Gerçek ①: arıza normaldir</h2>
<div class="formula">MTBF 3 yıl, 1.000 sunucu → 1.000 ÷ 3 = 333 arıza/yıl → günde ~0,9 arıza
Günde en az bir arıza olasılığı: 10 düğüm %0,9 · 100 düğüm %8,7 · 1.000 düğüm %59,9 · 10.000 düğüm %100</div>
<p>Bu bir ölçüm değil hesap; amaç büyüklük mertebesi. 0,91 bir <i>adet</i> (uzun vadeli ortalama), %59,9 bir <i>olasılık</i>. Sonuç: sistem arızadan sonra değil, <b>arıza sırasında</b> çalışmak zorundadır.</p>
<div class="box key"><span class="label">Kısmi arıza: tek makinede olmayan üçüncü hâl</span>A, B'ye istek attı, cevap gelmedi. Üç ihtimal: (1) B hiç almadı, (2) B işi yaptı ama cevap kayboldu, (3) B yavaş. Hangisi olduğunu bilmenin yolu yoktur. "Tekrar dene" derseniz iş iki kez yapılabilir; "deneme" derseniz hiç yapılmamış olabilir. Çözüm: işlemleri <b>idempotent</b> tasarlamak (iki kez yapmak = bir kez yapmak).</div>

<h2>3. Gerçek ②: bölümleme</h2>
<div class="table-wrap"><table>
<tr><th>Yöntem</th><th>Kural</th><th>Artısı</th><th>Riski</th></tr>
<tr><td>Aralık</td><td>id 0–1M → düğüm 0 …</td><td>Aralık sorgusu tek düğüme gider</td><td>Artan anahtarda bütün yeni yazmalar son düğüme</td></tr>
<tr><td>Hash</td><td>hash(anahtar) % N</td><td>Yük dağılır</td><td>Aralık sorgusu her düğüme gider; N değişince felaket</td></tr>
<tr><td>Tutarlı hash</td><td>Düğümler ve anahtarlar aynı çemberde; anahtar saat yönünde ilk düğüme</td><td>N değişince az veri taşınır</td><td>Karmaşık; sanal düğüm gerekir</td></tr>
</table></div>
<p><b>Aralığın tuzağı:</b> siparis_id artan sayaçsa bugünün bütün siparişleri tek düğümde: veri dengeli görünür ama <b>yazma yükü</b> dengesizdir; satır sayısına bakarak fark edilmez.</p>
<h3>Sıcak nokta ve en yavaş düğüm</h3>
<p>8 milyon olay, 8 kova. urun_id'ye göre hash: en dolu ÷ ortalama = 1,00. musteri_id'ye göre: <b>1,79</b>, çünkü tek bir müşteri olayların %13,5'ini üretmiş.</p>
<div class="box key"><span class="label">Ezberlenecek cümle</span><b>Hash anahtarları dağıtır, satırları değil.</b> Bir anahtar tek başına büyükse hiçbir bölümleme onu bölemez; hash fonksiyonunu değiştirmek işe yaramaz. Çözüm anahtarı değiştirmek: <b>tuzlama</b> (musteri_id + rastgele ek), sonra sonuçları birleştirmek.</div>
<p>Aynı toplam iş, iki dağıtım: çarpık dağıtımda <b>ortalama düğüm daha az çalıştı</b> (1,16 ↔ 1,39 s) ama iş daha geç bitti (2,33 ↔ 1,94 s). Kümenin hızını ortalama değil <b>en yavaş düğüm</b> (straggler) belirler.</p>
<h3>Yeniden dengeleme: 4 → 5 düğüm</h3>
<div class="table-wrap"><table>
<tr><th>Yöntem</th><th>Taşınan anahtar</th><th>Taşınan satır</th></tr>
<tr><td>mod N</td><td>%80</td><td>%72,8</td></tr>
<tr><td>Tutarlı hash (200 sanal nokta)</td><td>%19,8</td><td>%18,0</td></tr>
<tr><td>Teorik alt sınır</td><td colspan="2">%20 (yeni düğümün payı)</td></tr>
</table></div>
<p>mod 4 ile mod 5'in kalanları ilgisiz sayılardır, neredeyse her anahtar yer değiştirir. Tutarlı hash'te yalnız yeni işaretle bir öncekinin arasındaki anahtarlar taşınır. Sanal düğümler yayları eşitler. Memcached, Cassandra, DynamoDB'nin temelidir. Taşınan her satır bir ağ faturası ve kesinti süresidir.</p>

<h2>4. Gerçek ③: çoğaltma</h2>
<p>Üç gerekçe: <b>dayanıklılık</b> (disk ölünce veri kalsın), <b>erişilebilirlik</b> (düğüm ölünce hizmet sürsün), <b>okuma başarımı</b>.</p>
<div class="table-wrap"><table>
<tr><th></th><th>Eşzamanlı</th><th>Eşzamansız</th></tr>
<tr><td>Lider ne zaman "tamam" der</td><td>Takipçi onaylayınca</td><td>Hemen</td></tr>
<tr><td>Yazma gecikmesi</td><td>Yavaş (en yavaş takipçi kadar)</td><td>Hızlı</td></tr>
<tr><td>Lider ölürse</td><td>Veri kaybı yok</td><td>Onaylanmış ama kopyalanmamış yazmalar kaybolur</td></tr>
<tr><td>Takipçi yavaşlarsa</td><td>Yazma durur</td><td>Etkilenmez</td></tr>
</table></div>
<p>Bedava öğle yemeği yok: çoğu sistem <b>yarı eşzamanlı</b> çalışır.</p>
<h3>Quorum: W + R &gt; N</h3>
<p>N kopya, yazma W kopyaya, okuma R kopyaya dokunur. W + R &gt; N ise iki küme en az bir kopyada <b>kesişmek zorundadır</b> (güvercin yuvası) → okuma en son yazmayı görür. Benzetimde kuralı sağlayan her satırda eski veri oranı tam %0. <b>N=3, W=2, R=2</b> en yaygın: kuralı sağlar ve bir düğüm ölse bile hem yazma hem okuma sürer. N=3, W=3 de sağlar ama tek arızada yazma durur. W + R ≤ N bozuk değil, farklı bir sözdür: "hızlıyım, bazen eski veri dönerim."</p>
<div class="box warn"><span class="label">Çoğaltma yedek değildir</span>Çoğaltma her komutu kopyalar — <b>silme komutunu da</b>. Donanım arızasına karşı korur; insan hatası, bozulma ve fidye yazılımına karşı korumaz; zaman boyutu yoktur. Yedek ise geçmişe dönmeyi sağlar ama <b>ancak geri yükleme denenerek</b> çalıştığı anlaşılır.</div>

<h2>5. Gerçek ④: bölünme ve tutarlılık</h2>
<p><b>Ağ bölünmesi:</b> iki taraf da ayakta ama birbirini göremiyor; her biri diğerini ölü sanır. <b>P bir tercih değil, ağın gerçeğidir</b>: P'yi seçmezsiniz, P size olur.</p>
<p><b>CAP</b> (Brewer 2000, Gilbert &amp; Lynch 2002): bölünme anında <b>C</b> (isteği reddet, yanlış veri yok, hizmet durur) ya da <b>A</b> (kabul et, hizmet sürer, taraflar ayrışır).</p>
<div class="table-wrap"><table>
<tr><th>Sistem</th><th>Bölünmede</th><th>Neden</th></tr>
<tr><td>Banka hesabı · uçuş rezervasyonu</td><td>C</td><td>Yanlış veri geri alınamaz</td></tr>
<tr><td>Alışveriş sepeti · beğeni sayısı</td><td>A</td><td>Kesinti daha pahalı; sonradan birleştirilebilir</td></tr>
</table></div>
<div class="box warn"><span class="label">"CA seçtim" yanlıştır</span>CA diye bir sistem yoktur: bölünme olmadığı sürece her sistem C ve A'yı birlikte verir; CAP yalnızca bölünme anı hakkındadır. Ayrıca SLA'daki %99,9 bir <i>oran</i>dır, CAP'ın A'sı ise istisnasız garanti: Raft kullanan etcd teoremin A'sını bırakır ama %99,9 SLA verebilir.</div>
<p><b>PACELC</b> (Abadi 2012): bölünme varsa A ↔ C; <b>yoksa (Else) gecikme (L) ↔ C</b>. Bölünme nadirdir; asıl soru "normal günümde hangi takası yapıyor?". Cassandra PA/EL, MongoDB PA/EC, HBase/BigTable PC/EC, DynamoDB ayarlanabilir.</p>
<div class="table-wrap"><table>
<tr><th>Tutarlılık modeli</th><th>Sözü</th><th>Örnek</th></tr>
<tr><td>Güçlü (linearizable)</td><td>Her okuma en son yazmayı görür; koordinasyon ister</td><td>Banka bakiyesi</td></tr>
<tr><td>Okuduğunu-oku</td><td>Kendi yazdığını hep görürsün</td><td>Kendi yorumun</td></tr>
<tr><td>Monotonik okuma</td><td>Yeniyi gördüysen bir daha eskiyi görmezsin</td><td>Zaman tüneli</td></tr>
<tr><td>Nihai (eventual)</td><td>Yazma durursa kopyalar sonunda eşitlenir; en ucuz</td><td>Beğeni sayacı</td></tr>
</table></div>

<h2>6. Mutabakat ve Raft</h2>
<p>Lider ölünce yeniyi kim seçer? İki düğüm aynı anda "liderim" derse veri ikiye ayrılır: <b>split brain</b>. Raft (2014): dönem (term) ve oy; <b>çoğunluğun</b> (N/2+1) oyunu alan lider olur; lider değişiklikleri sıralı günlüğe yazar, çoğunluk "yazdım" deyince kesinleşir. 5 düğüm 2–3 bölünürse yalnız 3'lük taraf lider seçebilir: iki ayrı çoğunluk aynı anda var olamaz.</p>
<div class="table-wrap"><table>
<tr><th>Düğüm</th><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr>
<tr><th>Dayanılan ölüm</th><td>1</td><td>1</td><td>2</td><td>2</td><td>3</td></tr>
</table></div>
<p>Çift sayı para israfıdır: 4 düğüm de 3 kadar arızaya dayanır ama daha pahalı ve yavaştır. ZooKeeper, etcd (Kubernetes), Kafka KRaft (Kafka 4.0, 2025'te ZooKeeper'ı kaldırdı) hep 3/5/7 düğüm.</p>

<h2>7. Zaman güvenilmez</h2>
<p>Saatler kayar (clock skew); NTP geriye de sıçratabilir. Zaman damgasına bakıp "en büyük kazanır" demek gerçekte sonra olan yazmayı kaybettirebilir. Çözüm: <b>mantıksal saatler</b> (Lamport, vektör saati). <b>Olay zamanı</b> (tıklandığı an) ≠ <b>işlem zamanı</b> (sunucuya ulaştığı an).</p>

<h2>Vaka: GitLab, 31 Ocak 2017</h2>
<p>Replikasyonu onaran mühendis yanlışlıkla birincil veritabanının dizinini sildi (~300 GB). ~6 saatlik veri kayboldu (5.000 proje, 5.000 yorum, 700 kullanıcı), hizmet ~18 saat kapalı kaldı. Beş kurtarma yolunun hiçbiri planlandığı gibi çalışmadı: pg_dump sürüm uyuşmazlığı (uyarı e-postaları reddediliyordu), Azure anlık görüntüsü hiç etkinleştirilmemişti, LVM görüntüsü felaket kurtarma için değildi, replika zaten kopmuştu. Veri bir mühendisin elle aldığı görüntüden kurtarıldı: <b>şans</b>.</p>
<div class="box key"><span class="label">Üç ders</span>(1) Çoğaltma yedek değildir. (2) Test edilmemiş yedek, yedek değildir. (3) Sessiz başarısızlık en tehlikelisidir. Postmortem kültürü suçlu aramak değil, "sistem buna neden izin verdi?" diye sormaktır.</div>
`
},
{
  id: 4,
  title: 'Dağıtık Depolama: HDFS ve Nesne Deposu',
  short: '128 MB blok hesabı, NameNode–DataNode, okuma/yazma yolu, NameNode HA, raf farkındalığı, küçük dosya, nesne deposu, atomik olmayan yeniden adlandırma.',
  principle: 'Meta veri, verinin kendisi kadar kritiktir. Küçük dosyanın bedeli diskte değil, tek bir makinenin belleğinde ödenir.',
  body: `
<h2>1. Neden blok? Neden 128 MB?</h2>
<p>HDFS dosyayı bloklara böler (varsayılan <b>128 MB</b>, Hadoop 1'de 64 MB; <code>dfs.blocksize</code>). 128 MB bir <b>üst sınırdır, ayrılan alan değil</b>: 300 MB'lık dosya 128 + 128 + 44 MB olur, son blok diskte yalnız 44 MB tutar.</p>
<div class="formula">Varsayım: arama (seek) 10 ms · aktarım 100 MB/s → 1 MB = 10 ms
Hedef: arama, aktarımın %1'i olsun → aktarım 1 s → 100 MB → ikinin kuvveti: 128 MB
128 MB'ta arama payı = 10 ÷ (10 + 1.280) ≈ %0,8</div>
<p>Arama süresi blok boyutundan bağımsızdır: blok küçükse zaman aramaya, büyükse aktarıma gider. Ama blok çok büyük de olmamalı: <b>her blok bir görev</b> demektir (Hafta 5).</p>
<div class="table-wrap"><table>
<tr><th>1 GB dosya, 100 makine</th><th>1 GB blok</th><th>128 MB blok</th><th>1 MB blok</th></tr>
<tr><td>Görev</td><td>1 → 99 makine boşta</td><td>8 paralel</td><td>1.024</td></tr>
<tr><td>Arama payı</td><td>≈ %0,1</td><td>%0,8</td><td>%50</td></tr>
<tr><td>Sorun</td><td>Paralellik yok</td><td>Denge</td><td>Görev başlatma bedeli; 1 PB'ta NameNode'da 150 GB</td></tr>
</table></div>

<h2>2. NameNode ve DataNode</h2>
<div class="table-wrap"><table>
<tr><th></th><th>NameNode</th><th>DataNode</th></tr>
<tr><td>Sayı</td><td>Bir etkin (+ yedek)</td><td>Yüzlerce, binlerce</td></tr>
<tr><td>Tutar</td><td>Meta veri: dizin ağacı, dosya → blok, blok → DataNode</td><td>Blokların kendisi (diskte sıradan dosya: blk_…)</td></tr>
<tr><td>Nerede</td><td><b>RAM</b></td><td>Yerel disk</td></tr>
<tr><td>Çökerse</td><td>Bütün dosya sistemi erişilemez</td><td>Bloklar başka kopyalardan okunur</td></tr>
</table></div>
<p><b>Dosya bir tariftir:</b> adı + hangi bloklardan hangi sırayla oluştuğu. Bölünmemiş kopyası hiçbir yerde durmaz. Bir blok yalnız tek dosyaya aittir.</p>
<div class="box key"><span class="label">Okuma yolu: veri NameNode'dan geçmez</span>İstemci NameNode'a "bloklar nerede?" diye sorar, yalnız adresleri alır, blokları doğrudan (en yakın) DataNode'lardan okur. NameNode bir santraldir. Veri ondan geçseydi kümenin bütün bant genişliği tek ağ kartına sıkışırdı. DataNode'lar heartbeat ve blok listesi gönderir; susan DataNode'un blokları başka yere kopyalanır (küme kendini iyileştirir).</div>
<h3>Yazma yolu</h3>
<p>İstemci dosyayı sırayla okur; her blok için NameNode'dan 3 DataNode ister. Baytlar <b>64 KB'lık paketler</b> hâlinde <b>boru hattıyla</b> akar: istemci → DN3 → DN7 → DN9. Her paket üç kopyaya da aynı sırayla gider; her DataNode bloğun tam kopyasını kendisi örer (128 MB = 2.048 paket). Blok bütün hâlinde zincirle aktarılsaydı 3 × 1,28 = 3,84 s; boru hattıyla ≈ 1,28 s. Blok = depolama birimi (kalıcı, NameNode bilir); paket = taşıma birimi (geçici, NameNode görmez).</p>
<h3>RAM uçucu, meta veri neden kaybolmuyor?</h3>
<p>RAM hız içindir; kalıcılık üç yerden: <b>fsimage</b> (ağacın fotoğrafı, diskte), <b>değişiklik günlüğü</b> (önce günlüğe, sonra "tamam"), <b>blok raporları</b> (blok → DataNode haritası diske hiç yazılmaz, açılışta DataNode'lardan kurulur). RAM'in asıl bedeli kalıcılık değil <b>kapasite</b>: bütün ağaç tek makinenin RAM'ine sığmalı.</p>

<h2>3. NameNode tek hata noktası mı?</h2>
<p>Hadoop 1'de evet. Bugün <b>NameNode HA</b>, Hafta 3'ün üç fikridir:</p>
<div class="table-wrap"><table>
<tr><th>Hafta 3 fikri</th><th>NameNode HA'daki karşılığı</th></tr>
<tr><td>Lider-takipçi</td><td>Etkin NameNode yazar, bekleyen aynı değişiklikleri uygular</td></tr>
<tr><td>Çoğunluk / quorum</td><td>Değişiklik günlüğü en az 3 <b>JournalNode</b>'a yazılır; çoğunluk onaylayınca kesinleşir</td></tr>
<tr><td>Dönem numarası + fencing</td><td>Her yeni etkin daha büyük <b>epoch</b> alır; JournalNode'lar eski numaralı yazmayı reddeder → split brain önlenir</td></tr>
</table></div>
<p>Devretmeyi <b>ZooKeeper</b> başlatır. JournalNode hafiftir, genelde yönetici sunucuların üstünde çalışır; tek sayıda (3, 5, 7). Kopyalar başka makinede durur çünkü <b>arızalar bağımsız olmalı</b>: yerel disk makineyle birlikte ölür. Önceki tek NFS diski de tek hata noktasıydı. Replikasyon faktörü (3) yalnız veri bloklarına uygulanır; meta veri HDFS bloğu olarak saklanmaz.</p>

<h2>4. Raf farkındalığı</h2>
<p>Bir raf bütünüyle düşebilir (raf anahtarı, güç). Raflar arası trafik çekirdek ağ anahtarından geçer: kümenin en dar boğazı.</p>
<div class="table-wrap"><table>
<tr><th>Yerleşim</th><th>Bir raf düşerse</th><th>Raflar arası yazma</th></tr>
<tr><td>Üçü aynı raf</td><td>Veri gider</td><td>0</td></tr>
<tr><td>Üç ayrı raf</td><td>Yaşar</td><td>2 kez</td></tr>
<tr><td><b>1 + 2 (HDFS)</b></td><td>Yaşar</td><td><b>1 kez</b></td></tr>
</table></div>
<p>HDFS kuralı: 1. kopya yazanın makinesine, 2. başka rafa, 3. ikinciyle aynı rafa farklı makineye. Dönemin ilk açık ödünleşimi: iki rafın aynı anda düşmesi göze alınmış risktir.</p>

<h2>5. Küçük dosya problemi</h2>
<div class="formula">NameNode'da her dosya, dizin ve blok ≈ 150 B (Cloudera, 2009)
10 M dosya (her biri < 1 blok) → 10 M dosya kaydı + 10 M blok kaydı = 20 M × 150 B ≈ 3 GB
— tek bayt veri saklamadan. "10 M × 150 B = 1,5 GB" eksik hesaptır.</div>
<div class="table-wrap"><table>
<tr><th>Aynı 1 TB, dosya boyutu</th><th>NameNode belleği</th></tr>
<tr><td>1 GB</td><td>1,3 MB</td></tr>
<tr><td>128 MB</td><td>2,3 MB</td></tr>
<tr><td>1 MB</td><td>300 MB</td></tr>
<tr><td>100 KB</td><td>3.072 MB</td></tr>
</table></div>
<p>Veri aynı, bellek 2.300 kat farklı. Ayrıca her dosya ayrı NameNode sorusu, ayrı bağlantı, genelde ayrı görev ve nesne deposunda pahalı listeleme demektir. Kaynak: dakikada dosya yazan akış işleri, gereğinden ince bölümleme (<code>tarih=/saat=/sensor=</code>). Çözüm: <b>birleştirme (compaction)</b>, Parquet, ölçülü bölümleme (bölüm başına birkaç yüz MB), tablo biçimleri.</p>

<h2>6. Nesne deposu</h2>
<p>S3, Azure Blob, GCS, MinIO, SeaweedFS: veriyi klasör ağacında değil, <b>düz bir kova</b>da anahtarla bulunan nesneler olarak saklar. Nesne = anahtar + içerik + meta veri; <b>değiştirilemez</b> (güncellemek yeniden yazmaktır). API: HTTP PUT, GET, DELETE, LIST.</p>
<div class="box key"><span class="label">"Klasör" yoktur</span><code>log/tarih=2026-10-04/parca-1.jsonl</code> tek bir anahtardır; <code>/</code> sıradan bir karakter. Arayüzdeki klasörler ortak <b>önek</b>li anahtarların görüntüsüdür (düz ad alanı).</div>
<div class="table-wrap"><table>
<tr><th></th><th>HDFS</th><th>Nesne deposu</th></tr>
<tr><td>Yeniden adlandırma</td><td>Meta veri, tek işlem, <b>atomik</b></td><td>Her nesne kopyala + sil: 1.000 dosya = 2.000 istek</td></tr>
<tr><td>Listeleme</td><td>NameNode RAM'inden</td><td>HTTP; cevap başına en çok 1.000 anahtar, devam fişiyle <b>sırayla</b>: 1 M nesne = 1.000 istek</td></tr>
<tr><td>Var olan dosyaya ekleme</td><td>✅</td><td>❌</td></tr>
<tr><td>Ölçek sınırı</td><td>NameNode belleği</td><td>Pratikte yok</td></tr>
<tr><td>Hesaplamayla</td><td>Aynı makineler (veri yerelliği)</td><td>Ayrı, ağ üzerinden</td></tr>
</table></div>
<p><b>Depolama–hesaplama ayrışması:</b> depolama ayrı büyür ve ayrı ödenir, hesaplama gerekince açılır; kopyaları sağlayıcı tutar; işletme yükü yok; Spark, DuckDB, Trino aynı veriyi aynı anda okur. Bedeli: her işlem bir HTTP isteği.</p>
<h3>Teslim (commit) neden tehlikeli?</h3>
<p>Spark görevleri <code>_temporary/</code>'ye yazar, hepsi bitince <code>sonuc/</code>'a <b>yeniden adlandırır</b> ve <code>_SUCCESS</code> yazar (FileOutputCommitter). Yöntem yeniden adlandırmanın ucuz ve atomik olduğunu varsayar: HDFS'te doğru, nesne deposunda yanlış. Demoda 1.000 dosyalık taşıma 400. dosyada çökertildi: <code>arsiv/</code> verinin %40'ını gösterdi ve <b>hata vermedi</b>, çünkü yarım klasör nesne deposu için geçerli bir durumdur.</p>
<p>Çözümler: S3'e özel committer (çok parçalı yükleme teslimde kapatılır) ve <b>tablo biçimleri</b> (Iceberg, Delta, Hudi): tablo = dizindeki dosyalar değil, <b>meta veri listesindeki dosyalar</b>; teslim = "güncel sürüm" işaretini atomik olarak v1 → v2 çevirmek. Yarım iş görünmez, LIST gerekmez, eski sürümler durur (zaman yolculuğu).</p>
<p><b>Tutarlılık artık bedel değil:</b> S3 Aralık 2020'den beri güçlü tutarlıdır. Asıl bedel listeleme ve yeniden adlandırmadır.</p>
<div class="table-wrap"><table>
<tr><th>Demo</th><th>Sonuç</th></tr>
<tr><td>1 M satır: 1 Parquet ↔ 2.000 küçük Parquet</td><td>Aynı sonuç, sorgu <b>~40–50 kat</b> yavaş (yerel diskte ~10 kat; nesne deposu 4–5 kat daha büyütüyor)</td></tr>
<tr><td>1.000 dosyalık klasörü taşımak</td><td>Yerel disk ~20–30 µs (1 işlem) ↔ nesne deposu ~1,9 s (2.000 istek)</td></tr>
</table></div>

<h2>Vaka: AWS S3, 28 Şubat 2017</h2>
<p>us-east-1'de bir mühendis faturalama sorunu için birkaç sunucuyu çıkaracakken komut parametresini yanlış girdi; çok daha fazla sunucu çıktı. Giden sunucular arasında <b>dizin alt sistemi</b> (her nesnenin meta verisi ve yeri; S3'ün NameNode'u) vardı. Yıllardır yeniden başlatılmamıştı; kesinti ~4 saat 17 dakika sürdü. AWS'nin durum panosu da S3'e bağımlı olduğu için güncellenemedi. Düzeltmeler: araç asgari kapasitenin altına düşüremez hâle geldi, dizin küçük hücrelere bölündü. Ders: sorun insanın değil sistemin hatasıydı.</p>
`
},
{
  id: 5,
  title: 'MapReduce: Bir Programlama Modeli',
  short: 'Veri yerelliği, map → combiner → partitioner → shuffle & sort → reduce, M×R, combiner kuralı, join desenleri, çarpıklık ve tuzlama, YARN, duvar.',
  principle: 'Büyük olanı taşıma, küçük olanı taşı — ve her groupBy bir shuffle\'dır.',
  body: `
<h2>1. Veri yerelliği: hesaplamayı veriye götür</h2>
<div class="formula">1 TB, 100 makine, disk 100 MB/s, ağ 10 Gbit/s (= 1,25 GB/s; 1 bayt = 8 bit)
(a) Veriyi tek makineye taşı: tek diskten 1.048.576 MB ÷ 100 MB/s ≈ 10.486 s ≈ 2,9 saat (99 makine boşta)
(b) Programı (1 MB) veriye götür: 0,08 s dağıtım + 10.486 MB ÷ 100 MB/s = 105 s
Oran ≈ 100 kat = makine sayısı</div>
<p>Hız farkı ağ hızından değil, <b>100 diskin aynı anda okumasından</b> ve verinin ağa hiç çıkmamasından gelir. Kural: <b>büyük olanı değil, küçük olanı taşı.</b></p>
<div class="table-wrap"><table>
<tr><th>Zamanlayıcı sırası</th><th>Görev nerede</th><th>Blok nasıl okunur</th></tr>
<tr><td>①</td><td>Kopyası olan makinede</td><td>Kendi diskinden, ağ yok</td></tr>
<tr><td>②</td><td>Kopyayla aynı raftaki makinede</td><td>Yalnız raf anahtarından</td></tr>
<tr><td>③</td><td>Başka rafta</td><td>Çekirdek anahtardan, en pahalı</td></tr>
</table></div>
<p>3 kopyanın ikinci faydası: zamanlama esnekliği (3 aday makine, iki rafa yayılmış). Blok kopyalanmaz, <b>görev taşınır</b>.</p>
<div class="box key"><span class="label">2026'da yerellik</span>Nesne deposunda disk yerelliği kayboldu (görev bloğu HTTP ile okur). Ama "büyük olanı taşıma" kuralı yaşıyor: <b>okumada</b> (Parquet'ten yalnız gereken sütunlar) ve <b>shuffle'da</b> (combiner).</div>

<h2>2. Model: iki fonksiyon, gerisi kütüphanenin</h2>
<p>Siz <b>map</b> (kayıt → (anahtar, değer) çiftleri) ve <b>reduce</b> (bir anahtar + bütün değerleri → sonuç) yazarsınız; isteğe bağlı combiner ve partitioner, M ve R sayıları. Kütüphane: bloklara bölme, görevleri verinin yanına yerleştirme, shuffle & sort, çöken görevi yeniden çalıştırma, yavaş göreve yedek.</p>
<details class="example" open><summary>Elle kelime sayma (2 blok, R = 2, bölümleyici: harf sayısı mod 2)</summary><div class="inner">
<div class="formula">Blok 1: veri bulut veri / ağ veri kod     Blok 2: bulut ağ veri / kod ağ bulut
Map: her kelime → (kelime, 1)                                  12 çift
Combiner: Map1 → (veri,3)(bulut,1)(ağ,1)(kod,1) · Map2 → (bulut,2)(ağ,2)(veri,1)(kod,1)   12 → 8 çift
Partitioner: veri(4)→R0 · ağ(2)→R0 · bulut(5)→R1 · kod(3)→R1
Shuffle & sort: R0 → (ağ,[1,2]) (veri,[1,3]) · R1 → (bulut,[1,2]) (kod,[1,1])   2 map × 2 reduce = 4 aktarım
Reduce: ağ 3 · veri 4 · bulut 3 · kod 2 → sağlama 12 ✓</div>
<p><b>Map neden saymaz?</b> Bloğun yalnız bir kısmını görür; "veri"nin başka bloklarda da geçtiğini bilemez. <b>Partitioner'ın tek kuralı:</b> aynı anahtar, hangi map'ten gelirse gelsin, aynı reduce'a gider. Anahtarların sırası garantidir, değerlerinki değil. R reduce görevi = R çıktı dosyası (part-00000…).</p>
</div></details>
<p><b>Blok sınırındaki satır:</b> map görevi, dosyanın başı değilse ilk yarım satırı atlar ve sonundaki yarım satırı bitirmek için sonraki bloğun birkaç baytını okur. Böylece her satırı tam bir görev okur. (Tek bir .gz bu yüzden bölünemez.)</p>

<h2>3. Shuffle: en pahalı adım</h2>
<div class="table-wrap"><table>
<tr><th>Maliyet</th><th>Ne olur</th></tr>
<tr><td>① Diske yazma</td><td>Map çıktısı R parçaya bölünür, sıralanır, <b>yerel diske</b> yazılır (makine çökerse baştan yapılmasın diye)</td></tr>
<tr><td>② Ağ</td><td>Her reduce her map'ten kendi parçasını çeker: <b>M × R aktarım</b>; çoğu çekirdek anahtardan geçer, yerellik yok</td></tr>
<tr><td>③ Sıralama</td><td>Gelen parçalar anahtara göre birleştirilir; belleğe sığmazsa diske taşar</td></tr>
</table></div>
<p>Bir de bekleme: reduce fonksiyonu son map bitmeden çalışamaz. 1 TB, 128 MB blok, R = 100 → M = 8.192 → <b>819.200 aktarım</b>. M ve R'yi iki katına çıkarmak aktarımı dört katına çıkarır.</p>
<div class="table-wrap"><table>
<tr><th>Demo 1: 10 M kelime, 61,3 MB, M = 8, R = 4</th><th>Combiner kapalı</th><th>Combiner açık</th></tr>
<tr><td>Ara dosyalara yazılan</td><td>10 M çift · <b>118,5 MB</b> (girdinin 1,9 katı)</td><td>388.330 çift · 5,4 MB</td></tr>
<tr><td>Reduce yükleri</td><td>2,76 M · 2,56 M · 2,71 M · 1,96 M (eşit değil)</td><td>~97 bin × 4</td></tr>
<tr><td>Süre</td><td>9,5 s</td><td>1,7 s</td></tr>
</table></div>
<p>Ara veri girdiden büyük olabilir (her kelimeye bir "1" eklenir). Combiner map çıktısını değiştirmez; map'ten sonra, ağdan önce çalışır. Reduce yüklerinin eşitsizliği sık kelimelerden ("ve" 877 bin kez) gelir: partitioner <b>kelimeleri</b> eşit dağıtır, çiftleri değil.</p>

<h2>4. Combiner</h2>
<p>Spark'ta <code>reduceByKey</code> combiner'ı kendisi yapar: shuffle 3,3 MB ↔ combiner'sız <code>partitionBy</code> 46,1 MB (14 kat). Spark'ın MB'ları daha küçük çünkü shuffle'ı ikili ve sıkıştırılmış yazar; ama yön aynı.</p>
<details class="example"><summary>Combiner ortalamayı bozar — ne gönderdiğine bağlı</summary><div class="inner">
<div class="formula">Map A: 1, 2, 3 · Map B: 10 · doğru ortalama 16 ÷ 4 = 4
Ortalama gönderen combiner: (2 + 10) ÷ 2 = 6 ✗
(toplam, adet) gönderen combiner: (6+10, 3+1) = (16, 4) → 4 ✓</div>
</div></details>
<div class="table-wrap"><table>
<tr><th>İşlem</th><th>Combiner</th></tr>
<tr><td>Toplam, sayım, en büyük, en küçük</td><td>✅ değişmeli ve birleşmeli</td></tr>
<tr><td>Ortalama</td><td>❌ → (toplam, adet) taşınırsa ✅</td></tr>
<tr><td>Ortanca, farklı değer sayısı</td><td>❌</td></tr>
</table></div>
<div class="box warn"><span class="label">Neden bu kadar katı?</span>Combiner'ın <b>kaç kez çalışacağı garanti değildir</b> (hiç, bir, birçok). Sonuç bu sayıya bağlıysa combiner yanlıştır. Combiner'ın çıktısı reduce'un girdisiyle aynı türde olmalıdır.</div>

<h2>5. Join desenleri</h2>
<div class="table-wrap"><table>
<tr><th></th><th>Reduce tarafı join</th><th>Map tarafı (broadcast) join</th></tr>
<tr><td>Hareket eden</td><td>İki tablo da shuffle'dan geçer (değerler S/M etiketiyle)</td><td>Yalnız küçük tablo, her makineye bir kopya</td></tr>
<tr><td>Büyük tablo</td><td>Diske yazılır, ağdan geçer, sıralanır</td><td>Yerinde kalır, yerellik korunur</td></tr>
<tr><td>Eşleştirme</td><td>Reduce'ta</td><td>Map'te, bellekteki sözlükle</td></tr>
<tr><td>Şart</td><td>Yok, her zaman çalışır</td><td>Küçük tablo belleğe sığmalı</td></tr>
<tr><td>Spark adı</td><td>SortMergeJoin</td><td>BroadcastHashJoin (eşik 10 MB)</td></tr>
</table></div>
<div class="formula">1 TB ⋈ 50 MB, 100 makine: shuffle ≈ 1 TB · broadcast 50 MB × 100 ≈ 4,9 GB → ~210 kat
Küçük tablo 50 GB olsaydı: 50 GB × 100 = 5 TB → shuffle'dan 5 kat pahalı (zaten belleğe sığmaz)</div>
<p>Demo 3 (20 M ⋈ 100 bin): broadcast shuffle 1,7 KB · 0,9 s ↔ sort-merge 203,1 MB · 3,9 s. Kural: <b>bir taraf küçükse onu taşı, büyüğü yerinde bırak.</b></p>

<h2>6. Veri çarpıklığı: "iş %99'da takıldı"</h2>
<p>1.000 kullanıcı 4 M olay, 1 sıcak kullanıcı 4 M olay, R = 8: sıcak görev 4,5 M olay, ötekiler 500 bin → <b>9 kat</b>. 7 görev biter, ilerleme 7/8'de durur. Partitioner yükü görmez: karar yük belli olmadan verilir, aynı anahtar her map'ten aynı göreve gitmelidir (formülün sabit olması bir özelliktir), yüke bakmak koordinasyon ister.</p>
<div class="table-wrap"><table>
<tr><th>Çözüm</th><th>Nasıl</th><th>Ne zaman</th></tr>
<tr><td>Combiner</td><td>Sıcak anahtarın değerleri map'te tek değere iner</td><td>Toplama ise çoğu zaman kendiliğinden çözer</td></tr>
<tr><td>Tuzlama</td><td>sicak#0 … sicak#7; ikinci küçük aşama birleştirir</td><td>Sıralama, join'in sıcak tarafı</td></tr>
<tr><td>Ayrı işle</td><td>Sıcak anahtarları bul, broadcast join'le işle, kalanı shuffle, union</td><td>Sıcak anahtarlar az ve biliniyorsa</td></tr>
</table></div>
<div class="box key"><span class="label">Tuzlama bedava değildir</span>Demo 4 (4 çekirdek): reduce aşaması 1,60 → 1,05 s kısaldı ama bütün iş 4,0 → 4,3 s <b>uzadı</b> (ek iş 0,85 s, kazanç 0,55 s). Büyük kümede sıcak görev saatler sürüyorsa tablo döner: 4 saat → 2 saat. Ek iş paraleldir, sıcak görev seridir; kazanç sıcak görevin ne kadar beklettiğine bağlıdır.</div>

<h2>7. Hata toleransı ve YARN</h2>
<ul>
<li><b>Map görevi çöktü:</b> başka makinede yeniden; çöken makinede <i>biten</i> map'ler de yeniden çalışır, çünkü çıktıları o makinenin yerel diskindeydi.</li>
<li><b>Reduce çöktü:</b> yeniden çalışır; <i>biten</i> reduce'lar tekrarlanmaz, çıktıları HDFS'te 3 kopya.</li>
<li><b>Yavaş görev:</b> sona yaklaşınca yedeği başlatılır, önce biten sayılır (<b>spekülatif yürütme</b>).</li>
</ul>
<p>Google 2004 sıralaması: normal 891 s · 1.746 işçiden 200'ü öldürüldü 933 s (<b>%5</b>) · yedek görevler kapatıldı 1.283 s (<b>%44</b>). <b>Yavaş olan, ölü olandan daha tehlikeli.</b></p>
<div class="table-wrap"><table>
<tr><th>YARN rolü</th><th>Kaç tane</th><th>Ne yapar</th></tr>
<tr><td>ResourceManager</td><td>Kümede bir</td><td>Kaynak dağıtır, görev planlamaz</td></tr>
<tr><td>NodeManager</td><td>Her makinede</td><td>Container'ları başlatır, izler</td></tr>
<tr><td>ApplicationMaster</td><td>İş başına bir</td><td>NameNode'dan blok yerlerini öğrenir, verinin olduğu makinede container ister (yerellik burada)</td></tr>
<tr><td>Container</td><td>Görev başına</td><td>Çekirdek + bellek payı</td></tr>
</table></div>
<p>HDFS veriyi (disk), YARN hesaplamayı (çekirdek + bellek) yönetir; aynı makinelerde yan yana. Hadoop 1'de her şey tek JobTracker'daydı ve darboğaz oldu.</p>

<h2>8. MapReduce'un duvarı</h2>
<div class="formula">10 tur, 100 GB, küme disk hızı 10 GB/s
MapReduce: her tur 100 GB oku + 300 GB yaz (3 kopya) = 400 GB → 4.000 GB → 400 s
Ara sonuç bellekte: başta 100 GB oku + sonda 300 GB yaz = 400 GB → 40 s  (tur sayısı kadar fark)</div>
<p>Spark'ın iki fikri: <b>arada diske gitme</b> ve <b>kopya yerine tarif</b> (lineage): kayıp parça nasıl üretildiğinden yeniden hesaplanır.</p>
<p><b>Vaka: Google.</b> 2004 makalesi (Dean &amp; Ghemawat): indeksleme kodu 3.800 → 700 satır; Ağustos 2004'te 3.288 TB girdi, 758 TB ara veri, iş başına ortalama 1,2 ölen makine. 2014'te Urs Hölzle: "artık pek kullanmıyoruz" → Cloud Dataflow (Apache Beam). Terk edilen, her işi tek turla yazıp her turda diske dönmekti; <b>map, shuffle, reduce, combiner fikri yaşıyor</b>.</p>
<p><b>Garanti etiketi:</b> görevler yeniden çalışabildiği için belirlenimci olmalı; dış sisteme yazan (yan etkili) map iki kez yazabilir.</p>
`
},
{
  id: 6,
  title: 'Spark I: Tembel Değerlendirme ve Sorgu Planı',
  short: 'Driver–Executor, bölüm/görev/çekirdek, RDD ve soy ağacı, dönüşüm–eylem, cache, dar–geniş bağımlılık, iş/aşama/görev, DataFrame, Catalyst, explain().',
  principle: 'Spark kodunuzu satır satır çalıştırmaz; önce bütününü planlar. Planı okuyan, işi hızlandırır.',
  body: `
<h2>1. Mimari</h2>
<p>Spark 2009'da Berkeley'de (Zaharia) başladı; temel makale RDD (NSDI 2012). MapReduce'un duvarına üç cevap: <b>ara sonuç bellekte</b>, <b>kopya yerine tarif</b>, <b>önce planla sonra çalıştır</b>.</p>
<div class="table-wrap"><table>
<tr><th>Parça</th><th>Kaç tane</th><th>Ne yapar</th></tr>
<tr><td>Driver</td><td>Uygulama başına bir</td><td>Programınız: planı kurar, işi görevlere böler, dağıtır, sonucu toplar</td></tr>
<tr><td>Küme yöneticisi</td><td>Kümede bir</td><td>Kaynak dağıtır: YARN, Kubernetes, standalone</td></tr>
<tr><td>Executor</td><td>Uygulama başına birçok</td><td>Makinelerde süreç (JVM); görevleri çalıştırır, cache'i tutar. YARN'da bir container</td></tr>
</table></div>
<p>Executor makine değil <b>süreçtir</b>: bir makinede birden çok olabilir, bir Executor iki makineye bölünemez. Uygulama boyunca yaşar (MapReduce her görev için yeni JVM açardı). Dağıtım kipleri: <b>client</b> (Driver komutu verdiğiniz makinede), <b>cluster</b> (Driver kümenin içinde; üretim), <b>local[*]</b> (Driver ve tek Executor aynı süreçte; proje kiti).</p>
<div class="box key"><span class="label">Bölüm · görev · çekirdek</span>Veri bölümlere ayrılır, her bölüm için bir görev çıkar, her görev bir çekirdekte çalışır. Görevler çekirdekten fazlaysa dalga dalga: 8 görev ÷ 4 çekirdek = 2 dalga. 8.192 görev ÷ 1.600 çekirdek = 5,12 → 6 dalga; son dalgada 192 görev, çekirdeklerin %88'i boş.</div>

<h2>2. RDD ve soy ağacı</h2>
<p><b>RDD</b> = Resilient (kayıp bölüm tarifinden yeniden hesaplanır) Distributed (bölümlere ayrılıp makinelere dağılır) Dataset. <b>Değişmezdir</b>: filter yeni RDD üretir ve nereden, hangi işlemle geldiğini not eder. Bu notların zinciri <b>soy ağacı (lineage)</b>, yani bir tariftir. RDD verinin tamamıdır, bölüm onun parçasıdır (kitap ↔ sayfa).</p>
<div class="table-wrap"><table>
<tr><th></th><th>MapReduce</th><th>Spark</th></tr>
<tr><td>Turun sonucu</td><td>HDFS'e 3 kopya, sonraki tur diskten okur</td><td>Bellekte, kopya yok</td></tr>
<tr><td>Hata olmasa da ödenen</td><td>Her tur 3 kopya yazmak</td><td>Yok</td></tr>
<tr><td>Hata olunca</td><td>Kopyadan oku</td><td>Kaybolan bölümü tarifinden hesapla (beklenir)</td></tr>
</table></div>
<p>8 bölümden 1'i kaybolursa işin %12,5'i yeniden yapılır; diğer bölümlere dokunulmaz. Tarifin çalışması için dönüşümler <b>belirlenimci</b> olmalıdır. Geniş adımda kayıp pahalı olacağından Spark shuffle dosyalarını yine yerel diske yazar; çok uzun tarifleri <code>checkpoint()</code> keser.</p>
<p><b>toDebugString</b> aşağıdan yukarı okunur; parantezdeki sayı bölüm sayısı, <code>+-</code> girintisi <b>shuffle sınırı</b>dır. Yazdırılırken tek görev çalışmamıştır. PySpark ardışık Python fonksiyonlarını tek bir PythonRDD'de birleştirir.</p>

<h2>3. Tembel değerlendirme</h2>
<div class="table-wrap"><table>
<tr><th></th><th>Dönüşüm (transformation)</th><th>Eylem (action)</th></tr>
<tr><td>Örnek</td><td>select, filter, withColumn, groupBy().agg(), join, orderBy, map, flatMap, reduceByKey</td><td>count, collect, show, take, first, write.parquet, foreach</td></tr>
<tr><td>Çalışınca</td><td>Hiçbir şey olmaz, plana satır eklenir</td><td>Plan çalışır, iş (job) başlar</td></tr>
<tr><td>Döndürür</td><td>Yeni RDD / DataFrame</td><td>Python değeri ya da hiçbir şey</td></tr>
</table></div>
<p><b>groupBy da dönüşümdür</b>: shuffle'ı tarif eder ama başlatmaz. Demo 1 (20 M satır Parquet, 266,9 MB): üç dönüşüm 0,02–0,04 s, iş 0, okunan 0 bayt; <code>collect()</code> 1,52 s ve 89,1 MB okudu. Aynı sorgu ikinci kez yine 89,1 MB okudu: <b>Spark sonucu kendiliğinden saklamaz</b>. Dönüşümün süresi verinin boyundan bağımsızdır (yalnız şemaya bakar; yanlış sütun adı hemen hata verir).</p>
<p><b>Neden tembel?</b> Eylem gelince bütün tarifi görür: (1) gereksizi okuma (yalnız 3 sütun, 266,9 → 89,1 MB), (2) gereksizi hesaplama (limit(3) için ilk 3 eşleşmede dur), (3) <b>arayı yazma (pipelining)</b>: filter ve withColumn aynı görevde satır satır art arda çalışır, ara tablo oluşmaz; bellekte yalnız 12 kategori toplamı durur.</p>
<div class="box warn"><span class="label">Bedeli: her eylem baştan → cache()</span><div class="table-wrap"><table>
<tr><th></th><th>1. kullanım</th><th>2. kullanım</th><th>2 kullanım toplam</th></tr>
<tr><td>cache yok</td><td>1,52 s</td><td>0,64 s</td><td><b>2,16 s</b></td></tr>
<tr><td>cache var</td><td>3,05 s (doldurur)</td><td>0,23 s</td><td>3,28 s</td></tr>
</table></div>Cache'in ilk kullanımı daha yavaştır: 7 sütunun hepsi belleğe yazılır, cache'siz sorgu ise 3 sütun okur. Bu sorguda ancak ~7. kullanımda kâra geçer. Kural: aynı ara sonuç <b>≥ 2 kez</b> kullanılıyorsa ve belleğe sığıyorsa düşün; pahalı (join, shuffle'lı groupBy) sonuçlar 2.–3. kullanımda kazandırır. cache() de bir dönüşümdür, ilk eylemde dolar. İş bitince unpersist().</div>

<h2>4. İş, aşama, görev</h2>
<div class="table-wrap"><table>
<tr><th></th><th>Dar (narrow)</th><th>Geniş (wide)</th></tr>
<tr><td>Örnek</td><td>filter, map, withColumn, select</td><td>groupBy, reduceByKey, join, orderBy, distinct</td></tr>
<tr><td>Çocuk bölüm</td><td>Tek ebeveyn bölümden</td><td>Bütün ebeveyn bölümlerden parça</td></tr>
<tr><td>Ağ</td><td>Yok, aynı görevde</td><td>P × R aktarım: <b>shuffle</b></td></tr>
</table></div>
<div class="box key"><span class="label">Sayım kuralları</span><b>İş</b> = her eylem · <b>aşama</b> = shuffle sayısı + 1 · <b>görev</b> = her aşamanın bölüm sayısı toplamı. Kelime sayma: 8 bölüm, reduceByKey(add, 4), collect → 1 iş · 2 aşama · 8 + 4 = 12 görev. Görev sayısını adım sayısı değil bölüm sayısı belirler: dar adımlar aynı görevin içinde art arda yapılır.</div>
<p><b>Neden tam shuffle'da kesilir?</b> Seçim gecesi: sandıklar birbirini beklemeden sayar (aşama 0); "A partisinin il toplamı" için bütün sandıklar bitmeli ve tutanaklar ilgili masaya taşınmalı (shuffle); masalar toplar (aşama 1). Spark'ta bir işin içinde birden çok shuffle olabilir; MapReduce'ta her biri yeni bir iş ve HDFS turuydu. DataFrame'de AQE yüzünden bir eylem birden çok iş başlatabilir ("eylem başına en az bir iş").</p>
<p><b>Spark UI</b> (localhost:4040, Driver yaşadıkça açık): Jobs (hangi satır iş başlattı), Stages (görev, shuffle yazılan/okunan), SQL (planın canlı hâli), Storage (cache doldu mu), Executors. Varsayılan shuffle bölümü <code>spark.sql.shuffle.partitions</code> = 200 (kitte 8).</p>

<h2>5. DataFrame, Catalyst, explain()</h2>
<p><b>RDD:</b> torba dolusu satır; Spark içini bilmez, <b>nasıl</b>'ı siz yazarsınız. <b>DataFrame:</b> sütun adları ve türleri belli tablo; <b>ne</b> istediğinizi söylersiniz, yolu <b>Catalyst</b> seçer.</p>
<div class="formula">DataFrame/SQL → mantıksal plan (katalog denetimi) → optimize plan (filtre itme, sütun budama, sabit katlama)
             → fiziksel plan (join türü, Exchange) → kod + görevler (whole-stage code generation)</div>
<p>Demo 4 (aynı 20 M satır): RDD 38,15 s ↔ DataFrame 0,52 s → <b>~73 kat</b> (başka turda 144 kat; mertebe: iki mertebe). Üç neden:</p>
<ol>
<li><b>Python'a gidiş-geliş (en büyük pay):</b> RDD'de lambda bir Python fonksiyonudur; her satır serileştirilip Python'a gider, 20 milyon kez. DataFrame'de <code>F.col("sehir") == "Sakarya"</code> bir tariftir; bir kez verilir, iş JVM'de biter.</li>
<li><b>Gereksiz okuma:</b> lambda'nın içi görünmediği için RDD 7 sütunu okur (269 MB), DataFrame 3 sütunu (89,1 MB). 3 kat; 70 katın küçük bir parçası.</li>
<li><b>Genel ↔ özel kod:</b> DataFrame sorguya özel tek döngü derler; RDD her adımı ayrı çağırır, ara nesneler üretir. Tungsten: sıkışık ikili satırlar.</li>
</ol>
<div class="box warn"><span class="label">Python UDF tuzağı</span><code>F.udf(lambda t: t * 1.2)</code> Catalyst için kara kutudur: satırlar yine Python'a gider, o sütundaki filtre okuyucuya itilemez. Önce <code>pyspark.sql.functions</code>'ta hazır fonksiyon arayın; gerekirse <b>pandas UDF</b> (Arrow ile toplu sütun).</div>
<details class="example" open><summary>explain() aşağıdan yukarı: kötü sırayla yazılmış sorgu</summary><div class="inner">
<p>Sorgu: önce withColumn("kdvli"), sonra filter(sehir == Sakarya), groupBy(kategori), orderBy(ciro). Catalyst filtreyi Project'in <b>altına indirdi</b>, <code>isnotnull(sehir)</code> ekledi, sütunları 7'den 2'ye <b>budadı</b>.</p>
<div class="formula">AdaptiveSparkPlan (9)
+- Sort (8)
   +- Exchange (7)          rangepartitioning(ciro DESC, 8)   ← orderBy
      +- HashAggregate (6)  sum(kdvli)                         ← reduce
         +- Exchange (5)    hashpartitioning(kategori, 8)      ← groupBy, shuffle 3,0 KB
            +- HashAggregate (4)  partial_sum(kdvli)           ← combiner
               +- Project (3) · Filter (2)                      ← map, dar
                  +- Scan parquet (1)  PushedFilters: [IsNotNull(sehir), EqualTo(sehir,Sakarya)]
                                       ReadSchema: sehir, kategori, tutar (3/7 sütun)</div>
<p>2 Exchange → 2 shuffle → <b>3 aşama</b>. hashpartitioning: aynı anahtar aynı bölümde, sıra yok (groupBy, join). rangepartitioning: her bölüm bir değer aralığı, art arda okununca sıralı (orderBy).</p>
</div></details>
<div class="table-wrap"><table>
<tr><th>Planı okurken beş soru</th><th>Nereye bakılır</th><th>Kötüyse</th></tr>
<tr><td>① Kaç shuffle?</td><td>Exchange sayısı (+1 = aşama)</td><td>Gereksiz orderBy'ı at, broadcast join</td></tr>
<tr><td>② Her shuffle neden orada?</td><td>hashpartitioning(x) → groupBy/join · rangepartitioning → orderBy</td><td>O satırı değiştir</td></tr>
<tr><td>③ Ön toplama var mı?</td><td>Exchange altında partial_… HashAggregate</td><td>Ön toplamaya izin veren fonksiyon</td></tr>
<tr><td>④ Filtre okuyucuya indi mi?</td><td>PushedFilters dolu mu</td><td>Filtreyi ham sütuna yaz, UDF'ten kaçın, Parquet</td></tr>
<tr><td>⑤ Gereksiz sütun?</td><td>ReadSchema</td><td>Kullanmadığını seçme</td></tr>
</table></div>
<p>PushedFilters'ın dolu olması gerekli ama yeterli değil: demo verisinde her blokta her şehir olduğu için hiçbir blok atlanmadı; 89,1 MB'ın tamamı sütun budamasının eseri. Kazancı okunan bayttan ölçün.</p>

<h2>6. Tuzaklar</h2>
<div class="table-wrap"><table>
<tr><th>Satır</th><th>pandas</th><th>Spark</th></tr>
<tr><td>1.000</td><td>0,0001 s</td><td>0,11 s</td></tr>
<tr><td>1.000.000</td><td>0,0073 s</td><td>0,18 s</td></tr>
<tr><td>20.000.000</td><td>0,1316 s</td><td>0,15 s</td></tr>
</table></div>
<p>Küçük veride Spark yavaştır ve bu bir hata değildir: her iş plan kurar, aşamalara böler, görevleri dağıtır (~0,1 s sabit bedel; kümede saniyeler). Kargo şirketi ↔ elden teslim. Veri tek makineye sığıyorsa pandas/DuckDB daha hızlı ve basit.</p>
<div class="table-wrap"><table>
<tr><th>Belirti</th><th>Neden</th><th>Çözüm</th></tr>
<tr><td>cache() yazdım, hızlanmadı</td><td>Tek kullanım ya da belleğe sığmadı</td><td>≥ 2 kullanım · Storage sekmesi</td></tr>
<tr><td>Kod bitti, hiçbir şey olmadı</td><td>Eylem yok</td><td>write / count / show</td></tr>
<tr><td>Driver bellek hatası</td><td>collect() bütün sonucu tek makineye çekti</td><td>show(20), take(n), write</td></tr>
<tr><td>Hata collect() satırını gösteriyor</td><td>Tembellik: veriye bağlı hata eylemde çıkar</td><td>Ara adımlarda küçük show()</td></tr>
<tr><td>PushedFilters: []</td><td>Filtre UDF'te/hesaplanmış sütunda, kaynak CSV/JSON</td><td>Ham sütun, Parquet</td></tr>
</table></div>

<h2>Vaka: Spark 100 TB'ı sıralıyor (2014)</h2>
<p>Daytona GraySort: Hadoop MapReduce (Yahoo, 2013) 102,5 TB'ı 72 dk'da 2.100 makineyle; Spark (Databricks, 2014) 100 TB'ı 23 dk'da 206 makineyle. <b>3 kat hızlı, 10 kat az makine</b>; makine başına 11,8 → 360 MB/s. Ve <b>bellekte değil</b>: sıralama tamamen diskte, cache kullanılmadan yapıldı; hız daha iyi shuffle, ağ ve görev planlamasından geldi. "Spark bellekte çalıştığı için hızlı" yarım bir doğrudur. Dürüst dipnot: rekor TritonSort'la paylaşıldı, donanım da farklıydı.</p>
`
},
]
