const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Veritabanı bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Veritabanı tablosunu otomatik oluştur
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        sender VARCHAR(255),
        subject TEXT,
        body TEXT,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Veritabanı tablosu hazır.");
  } catch (err) {
    console.error("Veritabanı hatası:", err);
  }
}
initDB();

// Ana sayfa kontrolü
app.get('/', (req, res) => {
  res.send('Kalıcı Mail Sunucusu Çalışıyor!');
});

// Gelen mailleri kaydetme endpoint'i
app.post('/api/inbound', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;
    await pool.query(
      'INSERT INTO emails (recipient, sender, subject, body) VALUES ($1, $2, $3, $4)',
      [recipient, sender, subject, body]
    );
    res.status(200).json({ success: true, message: 'Mail kaydedildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Belirli bir e-postanın kutusunu okuma endpoint'i
app.get('/api/inbox/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT * FROM emails WHERE recipient = $1 ORDER BY received_at DESC',
      [email]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
