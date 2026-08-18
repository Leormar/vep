// api/_auth.js — Verifica el token de Google (ID token) y que el correo esté autorizado.
const GOOGLE_CLIENT_ID = '371407102662-ldskfqrlusnvnp7hnrommd6h6red07p3.apps.googleusercontent.com';
const ALLOWED_EMAILS = [
  'drorjuela@lentesespecializados.com',
  'drarueda@lentesespecializados.com',
  'dralausilva@lentesespecializados.com'
];

export async function verifyDoctor(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if (!r.ok) return null;
    const p = await r.json();
    if (p.aud !== GOOGLE_CLIENT_ID) return null;
    const email = (p.email || '').toLowerCase();
    const verified = p.email_verified === true || p.email_verified === 'true';
    if (!verified || !ALLOWED_EMAILS.includes(email)) return null;
    return { email };
  } catch (e) { return null; }
}
