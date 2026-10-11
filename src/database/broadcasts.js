export function createBroadcastRepository(db, clock = Date.now) {
  const statements = new Map();
  const prepare = (sql) => {
    if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
    return statements.get(sql);
  };
  const jobQuery = prepare('SELECT * FROM broadcast_jobs WHERE id = ?');
  const statsQuery = prepare(
    `SELECT status, count(*) AS n FROM broadcast_recipients WHERE job_id = ? GROUP BY status`,
  );
  const iso = () => new Date(clock()).toISOString();
  function job(id) {
    const row = jobQuery.get(id);
    if (!row) return null;
    const counts = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0, uncertain: 0 };
    for (const { status, n } of statsQuery.all(id)) counts[status] = n;
    return {
      id: row.id,
      actorId: row.actor_id,
      payload: JSON.parse(row.payload),
      status: row.status,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      reason: row.reason,
      reportSent: Boolean(row.report_sent),
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }
  return {
    enqueueBroadcast(actorId, payload, recipients) {
      if (
        !/^[1-9]\d*$/.test(String(actorId)) ||
        !Array.isArray(recipients) ||
        recipients.some((id) => !/^[1-9]\d*$/.test(String(id)))
      )
        throw new TypeError('Некорректные получатели рассылки.');
      const json = JSON.stringify(payload);
      if (typeof payload.text !== 'string' || !payload.text.length || payload.text.length > 3500)
        throw new TypeError('Некорректный текст рассылки.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = prepare(`SELECT id FROM broadcast_jobs
          WHERE actor_id = ? AND payload = ? AND status IN ('queued', 'running') ORDER BY id LIMIT 1`).get(
          String(actorId),
          json,
        );
        if (existing) {
          db.exec('COMMIT');
          return job(existing.id);
        }
        const result = prepare(
          `INSERT INTO broadcast_jobs(actor_id, payload, created_at) VALUES (?, ?, ?)`,
        ).run(String(actorId), json, iso());
        const id = Number(result.lastInsertRowid);
        const insert = prepare(
          'INSERT INTO broadcast_recipients(job_id, telegram_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        );
        for (const recipient of recipients) insert.run(id, String(recipient));
        db.exec('COMMIT');
        return job(id);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    listBroadcasts(actorId, page = 0) {
      if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
        throw new TypeError('Некорректная страница.');
      const rows = prepare(
        'SELECT id FROM broadcast_jobs WHERE actor_id = ? ORDER BY id DESC LIMIT 6 OFFSET ?',
      ).all(String(actorId), page * 5);
      return { items: rows.slice(0, 5).map((row) => job(row.id)), page, hasNext: rows.length > 5 };
    },
    getBroadcast: job,
    broadcastIsActive(id) {
      return Boolean(
        prepare("SELECT 1 FROM broadcast_jobs WHERE id = ? AND status = 'running'").get(id),
      );
    },
    broadcastHasPending(id) {
      return Boolean(
        prepare(
          "SELECT 1 FROM broadcast_recipients WHERE job_id = ? AND status IN ('pending', 'sending') LIMIT 1",
        ).get(id),
      );
    },
    recoverBroadcasts() {
      db.exec(`UPDATE broadcast_recipients SET status = 'uncertain', error_code = 'RESTART_DURING_SEND' WHERE status = 'sending';
        UPDATE broadcast_jobs SET status = 'queued' WHERE status = 'running';`);
    },
    nextBroadcast() {
      const row = prepare(
        "SELECT id FROM broadcast_jobs WHERE status = 'queued' ORDER BY id LIMIT 1",
      ).get();
      if (!row) return null;
      prepare(
        "UPDATE broadcast_jobs SET status = 'running' WHERE id = ? AND status = 'queued'",
      ).run(row.id);
      return job(row.id);
    },
    claimBroadcastRecipient(id) {
      const row = prepare(`SELECT telegram_id AS telegramId, attempts FROM broadcast_recipients
        WHERE job_id = ? AND status = 'pending' AND next_at <= ? ORDER BY next_at, telegram_id LIMIT 1`).get(
        id,
        clock(),
      );
      if (!row) return null;
      const changed =
        prepare(`UPDATE broadcast_recipients SET status = 'sending', attempts = attempts + 1
        WHERE job_id = ? AND telegram_id = ? AND status = 'pending'`).run(id, row.telegramId);
      return changed.changes ? { ...row, attempts: row.attempts + 1 } : null;
    },
    setBroadcastRecipient(id, telegramId, status, { nextAt = 0, errorCode = null } = {}) {
      if (!['pending', 'sent', 'failed', 'skipped', 'uncertain'].includes(status))
        throw new TypeError('Некорректный статус отправки.');
      prepare(`UPDATE broadcast_recipients SET status = ?, next_at = ?, error_code = ?
        WHERE job_id = ? AND telegram_id = ? AND status = 'sending'`).run(
        status,
        nextAt,
        errorCode,
        id,
        String(telegramId),
      );
    },
    finishBroadcast(id) {
      prepare(`UPDATE broadcast_jobs SET status = 'completed', finished_at = ? WHERE id = ? AND status = 'running'
        AND NOT EXISTS (SELECT 1 FROM broadcast_recipients WHERE job_id = ? AND status IN ('pending', 'sending'))`).run(
        iso(),
        id,
        id,
      );
      return job(id);
    },
    cancelBroadcast(id, actorId, reason = 'Отменено администратором') {
      db.exec('BEGIN IMMEDIATE');
      try {
        const changed =
          prepare(`UPDATE broadcast_jobs SET status = 'cancelled', finished_at = ?, reason = ?
          WHERE id = ? AND actor_id = ? AND status IN ('queued', 'running')`).run(
            iso(),
            reason,
            id,
            String(actorId),
          );
        if (changed.changes)
          prepare(`UPDATE broadcast_recipients SET status = 'skipped', error_code = 'CANCELLED'
          WHERE job_id = ? AND status = 'pending'`).run(id);
        db.exec('COMMIT');
        return Boolean(changed.changes);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    deferBroadcast(id) {
      prepare(
        "UPDATE broadcast_recipients SET status = 'uncertain', error_code = 'QUEUE_INTERRUPTED' WHERE job_id = ? AND status = 'sending'",
      ).run(id);
      prepare(
        "UPDATE broadcast_jobs SET status = 'queued' WHERE id = ? AND status = 'running'",
      ).run(id);
    },
    pendingBroadcastReports() {
      return prepare(`SELECT id FROM broadcast_jobs WHERE status IN ('completed', 'cancelled') AND report_sent = 0 AND report_attempts < 5 AND report_next_at <= ?
        AND NOT EXISTS (SELECT 1 FROM broadcast_recipients WHERE job_id = broadcast_jobs.id AND status = 'sending') ORDER BY id LIMIT 5`)
        .all(clock())
        .map((row) => job(row.id));
    },
    pendingBroadcastAdminNotices() {
      return prepare(`SELECT id FROM broadcast_jobs WHERE status IN ('completed', 'cancelled') AND admin_notice_sent = 0
        AND NOT EXISTS (SELECT 1 FROM broadcast_recipients WHERE job_id = broadcast_jobs.id AND status = 'sending') ORDER BY id LIMIT 5`)
        .all()
        .map((row) => job(row.id));
    },
    markBroadcastAdminNotice(id) {
      prepare('UPDATE broadcast_jobs SET admin_notice_sent = 1 WHERE id = ?').run(id);
    },
    beginBroadcastReport(id) {
      prepare('UPDATE broadcast_jobs SET report_attempts = report_attempts + 1 WHERE id = ?').run(
        id,
      );
    },
    deferBroadcastReport(id, nextAt) {
      prepare('UPDATE broadcast_jobs SET report_next_at = ? WHERE id = ?').run(nextAt, id);
    },
    markBroadcastReported(id) {
      prepare('UPDATE broadcast_jobs SET report_sent = 1 WHERE id = ?').run(id);
    },
    getBroadcastPause() {
      return (
        prepare("SELECT value FROM broadcast_meta WHERE key = 'pause_until'").get()?.value ?? 0
      );
    },
    setBroadcastPause(until) {
      prepare(`INSERT INTO broadcast_meta(key, value) VALUES ('pause_until', ?)
        ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value)`).run(until);
    },
  };
}
