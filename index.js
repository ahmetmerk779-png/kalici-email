const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        sender VARCHAR(255),
        subject TEXT,
        body TEXT,
        is_starred BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Veritabanı tablosu hazır.");
  } catch (err) {
    console.error("Veritabanı hatası:", err);
  }
}
initDB();

// Gmail Tarzı Gelişmiş HTML Arayüzü
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kalıcı Mail - Webmail</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        :root {
          --bg-dark: #0f172a;
          --panel-dark: #1e293b;
          --border-dark: #334155;
          --accent-blue: #3b82f6;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
        }
        body { background-color: var(--bg-dark); color: var(--text-main); font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; height: 100vh; overflow: hidden; }
        
        /* Top Navigation */
        .top-bar { background-color: var(--panel-dark); border-bottom: 1px solid var(--border-dark); height: 65px; display: flex; align-items: center; padding: 0 1.5rem; }
        .search-box { background-color: #0f172a; border: 1px solid var(--border-dark); border-radius: 24px; padding: 6px 16px; color: var(--text-main); width: 100%; max-width: 500px; }
        .search-box input { background: transparent; border: none; color: white; outline: none; width: 100%; margin-left: 8px; }
        
        /* Layout Structure */
        .app-container { display: flex; height: calc(100vh - 65px); }
        .sidebar { width: 260px; background-color: var(--panel-dark); border-right: 1px solid var(--border-dark); padding: 1.5rem 1rem; display: flex; flex-direction: column; }
        .main-content { flex: 1; background-color: var(--bg-dark); display: flex; flex-direction: column; overflow: hidden; }
        
        /* Sidebar Links */
        .nav-link-custom { display: flex; align-items: center; padding: 10px 16px; color: var(--text-muted); text-decoration: none; border-radius: 12px; font-weight: 500; margin-bottom: 4px; transition: all 0.2s; }
        .nav-link-custom:hover, .nav-link-custom.active { background-color: #334155; color: white; }
        .nav-link-custom i { width: 24px; }
        
        /* Email Address Banner */
        .email-display { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid var(--accent-blue); border-radius: 14px; padding: 16px; margin-bottom: 1.5rem; }
        
        /* Inbox Mail List */
        .mail-list { flex: 1; overflow-y: auto; padding: 1rem; }
        .mail-item { background-color: var(--panel-dark); border: 1px solid var(--border-dark); border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; }
        .mail-item:hover { border-color: var(--accent-blue); transform: translateX(2px); }
        .mail-item.unread { border-left: 4px solid var(--accent-blue); font-weight: 600; }
        .star-btn { color: var(--text-muted); cursor: pointer; transition: color 0.2s; }
        .star-btn.active { color: #f59e0b; }
        
        /* Modal Customization */
        .modal-content { background-color: var(--panel-dark); border: 1px solid var(--border-dark); color: white; border-radius: 16px; }
        .modal-header { border-bottom: 1px solid var(--border-dark); }
        .modal-footer { border-top: 1px solid var(--border-dark); }
      </style>
    </head>
    <body>

      <!-- Top Navigation -->
      <div class="top-bar justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <h4 class="mb-0 fw-bold text-primary"><i class="fa-solid fa-envelope me-2"></i>GMail Temp</h4>
        </div>
        <div class="search-box d-flex align-items-center">
          <i class="fa-solid fa-magnifying-glass text-secondary"></i>
          <input type="text" id="searchInput" placeholder="Maillerde veya gönderende ara..." onkeyup="filterEmails()">
        </div>
        <div>
          <span class="badge bg-success rounded-pill px-3 py-2"><i class="fa-solid fa-circle me-1 small"></i>Canlı Bağlantı</span>
        </div>
      </div>

      <!-- App Container -->
      <div class="app-container">
        
        <!-- Sidebar -->
        <div class="sidebar">
          
          <div class="email-display text-center">
            <small class="text-secondary d-block mb-1">Aktif Posta Kutusu</small>
            <div class="fw-bold text-info text-truncate mb-2" id="currentEmailDisplay">Yükleniyor...</div>
            <div class="d-flex gap-1 justify-content-center">
              <button class="btn btn-sm btn-primary flex-grow-1" onclick="copyEmail()"><i class="fa-regular fa-copy me-1"></i>Kopyala</button>
              <button class="btn btn-sm btn-outline-light" onclick="generateNewEmail()"><i class="fa-solid fa-arrows-rotate"></i></button>
            </div>
          </div>

          <a href="#" class="nav-link-custom active" onclick="switchTab('all')"><i class="fa-solid fa-inbox"></i>Gelen Kutusu <span class="badge bg-primary ms-auto" id="mailCount">0</span></a>
          <a href="#" class="nav-link-custom" onclick="switchTab('starred')"><i class="fa-solid fa-star"></i>Yıldızlı Mailler</a>
          <a href="#" class="nav-link-custom" onclick="switchTab('read')"><i class="fa-solid fa-envelope-open"></i>Okunmuşlar</a>
          
          <div class="mt-auto pt-3 border-top border-secondary text-secondary small text-center">
            Render PostgreSQL Kalıcı Veritabanı
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="main-content">
          <div class="p-3 border-bottom border-secondary d-flex justify-content-between align-items-center">
            <h5 class="mb-0 fw-bold" id="tabTitle">Gelen Kutusu</h5>
            <button class="btn btn-sm btn-outline-info" onclick="fetchEmails()"><i class="fa-solid fa-rotate me-1"></i>Yenile</button>
          </div>

          <div class="mail-list" id="inboxContainer">
            <div class="text-center text-secondary py-5">
              <i class="fa-solid fa-spinner fa-spin fa-2x mb-3"></i>
              <p>Mailler yükleniyor...</p>
            </div>
          </div>
        </div>

      </div>

      <!-- Mail Detail Modal -->
      <div class="modal fade" id="mailDetailModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="modalSubject">Konu Başlığı</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex justify-content-between border-bottom border-secondary pb-3 mb-3">
                <div>
                  <div id="modalSender" class="fw-bold text-info">Gönderen: -</div>
                  <div id="modalRecipient" class="small text-secondary">Alıcı: -</div>
                </div>
                <div id="modalDate" class="small text-secondary">-</div>
              </div>
              <div id="modalBody" style="white-space: pre-wrap; font-size: 1rem; color: #e2e8f0;">
                Mail içeriği burada görünecek...
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
            </div>
          </div>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
        const DOMAIN = "kaliciemail.webredirect.org";
        let currentEmail = localStorage.getItem("saved_temp_email") || generateRandomEmail();
        let allMails = [];
        let currentTab = 'all';

        function generateRandomEmail() {
          const rand = Math.random().toString(36).substring(2, 8);
          const email = "user_" + rand + "@" + DOMAIN;
          localStorage.setItem("saved_temp_email", email);
          return email;
        }

        function generateNewEmail() {
          currentEmail = generateRandomEmail();
          document.getElementById("currentEmailDisplay").innerText = currentEmail;
          fetchEmails();
        }

        function copyEmail() {
          navigator.clipboard.writeText(currentEmail);
          alert("E-posta adresi kopyalandı!");
        }

        async function fetchEmails() {
          try {
            const res = await fetch("/api/inbox/" + encodeURIComponent(currentEmail));
            allMails = await res.json();
            renderMails();
          } catch (err) {
            console.error(err);
          }
        }

        function renderMails() {
          const container = document.getElementById("inboxContainer");
          let filtered = allMails;

          if (currentTab === 'starred') {
            filtered = allMails.filter(m => m.is_starred);
          } else if (currentTab === 'read') {
            filtered = allMails.filter(m => m.is_read);
          }

          const searchVal = document.getElementById("searchInput").value.toLowerCase();
          if (searchVal) {
            filtered = filtered.filter(m => 
              (m.subject && m.subject.toLowerCase().includes(searchVal)) || 
              (m.sender && m.sender.toLowerCase().includes(searchVal)) ||
              (m.body && m.body.toLowerCase().includes(searchVal))
            );
          }

          document.getElementById("mailCount").innerText = allMails.length;

          if (filtered.length === 0) {
            container.innerHTML = \`
              <div class="text-center text-secondary py-5">
                <i class="fa-solid fa-inbox fa-3x mb-3 opacity-50"></i>
                <p>Bu görünümde henüz bir e-posta yok.</p>
              </div>
            \`;
            return;
          }

          container.innerHTML = filtered.map(m => \`
            <div class="mail-item \${!m.is_read ? 'unread' : ''}" onclick="openMail(\${m.id})">
              <i class="fa-solid fa-star star-btn \${m.is_starred ? 'active' : ''}" onclick="toggleStar(event, \${m.id})"></i>
              <div style="width: 200px;" class="text-truncate fw-bold text-info">\${m.sender || 'Bilinmiyor'}</div>
              <div class="flex-grow-1 text-truncate">\${m.subject || 'Konusuz E-posta'}</div>
              <div class="small text-secondary">\${new Date(m.received_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          \`).join("");
        }

        function openMail(id) {
          const mail = allMails.find(m => m.id === id);
          if (!mail) return;

          mail.is_read = true;
          document.getElementById("modalSubject").innerText = mail.subject || 'Konusuz E-posta';
          document.getElementById("modalSender").innerText = "Gönderen: " + (mail.sender || 'Bilinmiyor');
          document.getElementById("modalRecipient").innerText = "Alıcı: " + mail.recipient;
          document.getElementById("modalDate").innerText = new Date(mail.received_at).toLocaleString();
          document.getElementById("modalBody").innerText = mail.body || 'İçerik boş';

          const modal = new bootstrap.Modal(document.getElementById('mailDetailModal'));
          modal.show();
          renderMails();
        }

        function toggleStar(e, id) {
          e.stopPropagation();
          const mail = allMails.find(m => m.id === id);
          if (mail) {
            mail.is_starred = !mail.is_starred;
            renderMails();
          }
        }

        function switchTab(tab) {
          currentTab = tab;
          document.querySelectorAll('.nav-link-custom').forEach(el => el.classList.remove('active'));
          event.currentTarget.classList.add('active');
          document.getElementById("tabTitle").innerText = 
            tab === 'all' ? 'Gelen Kutusu' : tab === 'starred' ? 'Yıldızlı Mailler' : 'Okunmuş Mailler';
          renderMails();
        }

        function filterEmails() {
          renderMails();
        }

        document.getElementById("currentEmailDisplay").innerText = currentEmail;
        fetchEmails();
        setInterval(fetchEmails, 5000); // Her 5 saniyede bir otomatik sorgular
      </script>
    </body>
    </html>
  `);
});

// Webhook
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

// Inbox API
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
