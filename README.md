# Büyük Veriye Giriş · Vize Kampı (BSM 461)

Sakarya Üniversitesi BSM 461 Büyük Veriye Giriş dersinin 2–6. hafta ders notlarından hazırlanmış çalışma sitesi.

- **Haftalar:** Tek makinenin sınırı ve Parquet · Dağıtık sistemlerin dört acı gerçeği · HDFS ve nesne deposu · MapReduce · Spark I
- **5 vize denemesi:** 100 yorum ağırlıklı soru (her denemede her haftadan 4 soru), hesap makinesi gerektirmez; her sorunun açıklaması var.

```bash
cd site && npm ci && npm run dev      # geliştirme
npx tsx scripts/check.ts               # soru yapısı kontrolü
npm run build                          # site/dist
```

GitHub Actions ile `main`e her push'ta GitHub Pages'e yayınlanır.
