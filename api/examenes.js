// api/examenes.js — Exámenes por paciente (Neon Postgres)
// GET  ?paciente_id=1  -> historial de exámenes del paciente (más reciente primero, para comparar)
// POST {paciente_id, modulo, fecha, datos, documento_ia} -> guarda un examen
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
      const { paciente_id, examen_id } = req.query;
      // Detalle completo de un examen (incluye documento IA y fotos) — bajo demanda
      if (examen_id) {
        const rows = await sql`SELECT * FROM examenes WHERE id = ${examen_id} LIMIT 1`;
        return res.status(200).json({ examen: rows[0] || null });
      }
      if (!paciente_id) return res.status(400).json({ error: 'paciente_id o examen_id requerido' });
      // Lista liviana: sin fotos ni documento pesado, solo metadatos + banderas
      const rows = await sql`
        SELECT id, paciente_id, modulo, fecha, datos, creado_en,
               (documento_ia IS NOT NULL AND length(documento_ia) > 0) AS tiene_doc,
               (fotos IS NOT NULL AND jsonb_array_length(fotos) > 0) AS tiene_fotos,
               COALESCE(jsonb_array_length(fotos), 0) AS num_fotos
        FROM examenes
        WHERE paciente_id = ${paciente_id}
        ORDER BY fecha DESC, creado_en DESC`;
      return res.status(200).json({ examenes: rows });
    }

    if (req.method === 'POST') {
      const e = req.body || {};
      if (!e.paciente_id || !e.modulo) {
        return res.status(400).json({ error: 'paciente_id y modulo son obligatorios' });
      }
      const rows = await sql`
        INSERT INTO examenes (paciente_id, modulo, fecha, datos, documento_ia, fotos)
        VALUES (${e.paciente_id}, ${e.modulo}, ${e.fecha || null},
                ${JSON.stringify(e.datos || {})}::jsonb, ${e.documento_ia || null},
                ${JSON.stringify(e.fotos || [])}::jsonb)
        RETURNING id, paciente_id, modulo, fecha, datos, documento_ia, creado_en,
                  (fotos IS NOT NULL AND jsonb_array_length(fotos) > 0) AS tiene_fotos`;
      return res.status(200).json({ examen: rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('examenes error', e);
    return res.status(500).json({ error: 'Error de base de datos' });
  }
}
