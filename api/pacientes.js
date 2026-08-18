// api/pacientes.js — Gestión de pacientes (Neon Postgres)
// GET  ?documento=CC   -> busca un paciente por cédula (detecta si ya existe)
// GET  ?q=texto        -> busca por nombre o documento
// GET                  -> últimos pacientes
// POST {documento,...} -> crea el paciente, o actualiza si la cédula ya existe (sin duplicar)
import { neon } from '@neondatabase/serverless';
import { verifyDoctor } from './_auth.js';

export const maxDuration = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const doctor = await verifyDoctor(req);
  if (!doctor) return res.status(401).json({ error: 'No autorizado. Inicia sesión con tu cuenta institucional.' });

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL no configurada en el servidor' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const { documento, q } = req.query;
      if (documento) {
        const rows = await sql`SELECT * FROM pacientes WHERE documento = ${documento} LIMIT 1`;
        return res.status(200).json({ existe: rows.length > 0, paciente: rows[0] || null });
      }
      if (q) {
        const like = `%${q}%`;
        const rows = await sql`SELECT * FROM pacientes WHERE nombre ILIKE ${like} OR documento ILIKE ${like} ORDER BY nombre LIMIT 50`;
        return res.status(200).json({ pacientes: rows });
      }
      const rows = await sql`SELECT * FROM pacientes ORDER BY creado_en DESC LIMIT 50`;
      return res.status(200).json({ pacientes: rows });
    }

    if (req.method === 'POST') {
      const p = req.body || {};
      if (!p.documento || !p.nombre) {
        return res.status(400).json({ error: 'documento (cédula) y nombre son obligatorios' });
      }
      // Upsert por documento: si la cédula ya existe, actualiza en vez de duplicar.
      const rows = await sql`
        INSERT INTO pacientes (documento, nombre, edad, sexo, telefono, email, medico_remitente, email_medico, es_referido)
        VALUES (${p.documento}, ${p.nombre}, ${p.edad || null}, ${p.sexo || null}, ${p.telefono || null},
                ${p.email || null}, ${p.medico_remitente || null}, ${p.email_medico || null}, ${p.es_referido || false})
        ON CONFLICT (documento) DO UPDATE SET
          nombre           = EXCLUDED.nombre,
          edad             = COALESCE(EXCLUDED.edad, pacientes.edad),
          sexo             = COALESCE(EXCLUDED.sexo, pacientes.sexo),
          telefono         = COALESCE(EXCLUDED.telefono, pacientes.telefono),
          email            = COALESCE(EXCLUDED.email, pacientes.email),
          medico_remitente = COALESCE(EXCLUDED.medico_remitente, pacientes.medico_remitente),
          email_medico     = COALESCE(EXCLUDED.email_medico, pacientes.email_medico),
          es_referido      = EXCLUDED.es_referido
        RETURNING *, (xmax = 0) AS creado_nuevo`;
      return res.status(200).json({ paciente: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('pacientes error', e);
    return res.status(500).json({ error: 'Error de base de datos' });
  }
}
