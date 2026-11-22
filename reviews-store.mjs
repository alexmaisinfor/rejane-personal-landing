import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openReviews(filename = path.join(process.cwd(), 'data', 'reviews.sqlite')) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS invitations(id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY, invitation_id INTEGER NOT NULL UNIQUE REFERENCES invitations(id),
      name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      message TEXT NOT NULL CHECK(length(message) BETWEEN 20 AND 1500),
      consent_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')));
    CREATE INDEX IF NOT EXISTS reviews_status_created ON reviews(status,created_at DESC);`);
  if (!db.prepare('PRAGMA table_info(reviews)').all().some(column => column.name === 'photo')) db.exec('ALTER TABLE reviews ADD COLUMN photo BLOB');
  if (!db.prepare('PRAGMA table_info(reviews)').all().some(column => column.name === 'pinned')) db.exec('ALTER TABLE reviews ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1))');
  db.exec('CREATE INDEX IF NOT EXISTS reviews_public_order ON reviews(status,pinned DESC,created_at DESC,id DESC)');
  db.exec('CREATE TABLE IF NOT EXISTS admin_access(token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS site_visits(accessed_at INTEGER NOT NULL)');
  db.exec(`CREATE TABLE IF NOT EXISTS appointments(
    id INTEGER PRIMARY KEY, request_id TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL, created_at INTEGER NOT NULL,
    consent_version TEXT NOT NULL DEFAULT 'contact-v2');`);
  const hash = token => createHash('sha256').update(token).digest('hex');
  function invitation(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare(`SELECT id FROM invitations i WHERE token_hash=? AND expires_at>?
      AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.invitation_id=i.id)`).get(hash(token), Date.now()) ?? null;
  }
  return {
    close: () => db.close(),
    recordVisit: () => db.prepare('INSERT INTO site_visits(accessed_at) VALUES(?)').run(Date.now()),
    saveAppointment(requestId,data) {
      const payload = JSON.stringify(data);
      db.prepare('INSERT INTO appointments(request_id,payload,created_at) VALUES(?,?,?) ON CONFLICT(request_id) DO NOTHING').run(requestId,payload,Date.now());
      const row = db.prepare('SELECT id,payload FROM appointments WHERE request_id=?').get(requestId);
      if (row.payload !== payload) { const error = new Error('Solicitação já registrada com outros dados. Feche e abra novamente o formulário.'); error.status=409; throw error; }
      return row.id;
    },
    appointments(offset = 0) {
      if (!Number.isSafeInteger(offset) || offset < 0) { const error = new Error('Página inválida.'); error.status=400; throw error; }
      const rows = db.prepare('SELECT id,payload,created_at FROM appointments ORDER BY id DESC LIMIT 51 OFFSET ?').all(offset);
      return {appointments:rows.slice(0,50).map(({payload,...row})=>({...row,...JSON.parse(payload)})),nextOffset:rows.length > 50 ? offset+50 : null};
    },
    visits(offset = 0) {
      if (!Number.isSafeInteger(offset) || offset < 0) { const error = new Error('Página inválida.'); error.status=400; throw error; }
      const rows = db.prepare('SELECT accessed_at FROM site_visits ORDER BY rowid DESC LIMIT 51 OFFSET ?').all(offset);
      return {visits:rows.slice(0,50),nextOffset:rows.length > 50 ? offset+50 : null,total:db.prepare('SELECT COUNT(*) AS total FROM site_visits').get().total};
    },
    createInvitation() {
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO invitations(token_hash,expires_at) VALUES(?,?)').run(hash(token), Date.now() + 7 * 86400000);
      return token;
    },
    invitation,
    createAdminAccess() {
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO admin_access(token_hash,expires_at) VALUES(?,?)').run(hash(token),Date.now() + 30 * 86400000);
      return token;
    },
    revokeAdminAccess: () => db.prepare('DELETE FROM admin_access').run().changes,
    isAdmin(token) {
      return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) && Boolean(db.prepare('SELECT 1 FROM admin_access WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now()));
    },
    adminReviews: () => db.prepare('SELECT id,name,rating,message,created_at,status,pinned,photo IS NOT NULL AS has_photo FROM reviews ORDER BY pinned DESC,created_at DESC,id DESC LIMIT 100').all(),
    photo(id, admin = false) {
      return db.prepare("SELECT photo FROM reviews WHERE id=? AND photo IS NOT NULL AND (status='approved' OR ?=1)").get(id,admin ? 1 : 0)?.photo;
    },
    submit(token, input, photo = null) {
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      const message = typeof input?.message === 'string' ? input.message.trim() : '';
      const rating = input?.rating;
      if (name.length < 2 || name.length > 80 || /[\u0000-\u001f]/.test(name) || message.length < 20 || message.length > 1500 || !Number.isInteger(rating) || rating < 1 || rating > 5 || input?.consent !== true) {
        const error = new Error('Informe nome (2–80 caracteres), nota de 1 a 5, relato (20–1500 caracteres) e autorização para publicar.');
        error.status = 422; throw error;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const invite = invitation(token);
        if (!invite) { const error = new Error('Convite inválido, expirado ou já utilizado.'); error.status = 410; throw error; }
        db.prepare('INSERT INTO reviews(invitation_id,name,rating,message,consent_at,created_at,photo) VALUES(?,?,?,?,?,?,?)').run(invite.id,name,rating,message,Date.now(),Date.now(),photo);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    published: () => db.prepare("SELECT id,name,rating,message,photo IS NOT NULL AS has_photo FROM reviews WHERE status='approved' ORDER BY created_at DESC,id DESC LIMIT 12").all(),
    publishedPage(cursor = null) {
      let after = null;
      if (cursor !== null) {
        try {
          if (typeof cursor !== 'string' || cursor.length > 200) throw new Error();
          after = JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
          if (!Array.isArray(after) || after.length !== 3 || ![0,1].includes(after[0]) || !Number.isSafeInteger(after[1]) || after[1] < 0 || !Number.isSafeInteger(after[2]) || after[2] < 1) throw new Error();
        } catch { const error = new Error('Página inválida. Atualize as avaliações.'); error.status=400; throw error; }
      }
      const where = after ? 'AND (pinned<? OR (pinned=? AND created_at<?) OR (pinned=? AND created_at=? AND id<?))' : '';
      const args = after ? [after[0],after[0],after[1],after[0],after[1],after[2]] : [];
      const rows = db.prepare(`SELECT id,name,rating,message,pinned,created_at,photo IS NOT NULL AS has_photo FROM reviews WHERE status='approved' ${where} ORDER BY pinned DESC,created_at DESC,id DESC LIMIT 4`).all(...args);
      const hasMore = rows.length > 3;
      const page = rows.slice(0,3);
      const last = page.at(-1);
      return {reviews:page.map(({created_at,...review}) => review),nextCursor:hasMore ? Buffer.from(JSON.stringify([last.pinned,last.created_at,last.id])).toString('base64url') : null};
    },
    pin(id, pinned) {
      if (!Number.isSafeInteger(id) || id < 1 || typeof pinned !== 'boolean') { const error = new Error('Avaliação inválida.'); error.status=400; throw error; }
      db.exec('BEGIN IMMEDIATE');
      try {
        const review = db.prepare("SELECT pinned FROM reviews WHERE id=? AND status='approved'").get(id);
        if (!review) { const error = new Error('Somente avaliações publicadas podem ser fixadas.'); error.status=409; throw error; }
        if (pinned && !review.pinned && db.prepare("SELECT COUNT(*) AS total FROM reviews WHERE status='approved' AND pinned=1").get().total >= 3) {
          const error = new Error('Limite de três avaliações fixadas. Desafixe uma antes de fixar outra.'); error.status=409; throw error;
        }
        db.prepare('UPDATE reviews SET pinned=? WHERE id=?').run(pinned ? 1 : 0,id);
        db.exec('COMMIT');
        return 1;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    pending: () => db.prepare("SELECT id,name,rating,message,created_at FROM reviews WHERE status='pending' ORDER BY created_at,id").all(),
    unpublish(id) {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('ID inválido.');
      return db.prepare("UPDATE reviews SET status='rejected',pinned=0 WHERE id=? AND status='approved'").run(id).changes;
    },
    moderate(id, status) {
      if (!Number.isSafeInteger(id) || id < 1 || !['approved', 'rejected'].includes(status)) throw new Error('ID ou ação inválidos.');
      return db.prepare("UPDATE reviews SET status=? WHERE id=? AND status='pending'").run(status,id).changes;
    },
  };
}
