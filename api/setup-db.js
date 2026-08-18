// api/setup-db.js — Crea las tablas usando la MISMA conexión DATABASE_URL de la app.
// Garantiza que las tablas existan en la base correcta. Llamar una vez (GET).
import { neon } from '@neondatabase/serverless';

export const maxDuration = 30;

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL no configurada' });
  }
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`CREATE TABLE IF NOT EXISTS pacientes (
      id               SERIAL PRIMARY KEY,
      documento        TEXT UNIQUE NOT NULL,
      nombre           TEXT NOT NULL,
      edad             INTEGER,
      sexo             TEXT,
      telefono         TEXT,
      email            TEXT,
      medico_remitente TEXT,
      email_medico     TEXT,
      es_referido      BOOLEAN DEFAULT FALSE,
      creado_en        TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS examenes (
      id            SERIAL PRIMARY KEY,
      paciente_id   INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
      modulo        TEXT NOT NULL,
      fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
      datos         JSONB,
      documento_ia  TEXT,
      creado_en     TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_examenes_paciente ON examenes(paciente_id)`;
    // Columna de fotos clínicas (array indexado por tipo de examen), agregada de forma segura
    await sql`ALTER TABLE examenes ADD COLUMN IF NOT EXISTS fotos JSONB`;
    const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
    return res.status(200).json({ ok: true, tablas: t.map(r => r.table_name) });
  } catch (e) {
    console.error('setup-db error', e);
    return res.status(500).json({ error: 'Error', detalle: String(e && e.message || e) });
  }
}
