// dein blick: zählt, wie oft ein zeichen unter einem werk gesetzt wurde.
// gespeichert werden nur zähler, keine namen, keine ip-adressen.
const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
const WERKE = ['pierre', 'nick', 'lena', 'lentini', 'kaan', 'samuel', 'luca'];
const ZEICHEN = ['ruhe', 'funke', 'raetsel', 'spannung'];

async function redis(befehle) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(befehle)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return r.json();
}

function zaehler(liste) {
  const o = {};
  ZEICHEN.forEach(z => { o[z] = 0; });
  if (Array.isArray(liste)) {
    for (let i = 0; i < liste.length; i += 2) {
      if (ZEICHEN.indexOf(liste[i]) > -1) o[liste[i]] = parseInt(liste[i + 1], 10) || 0;
    }
  }
  return o;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) { res.status(503).json({ fehler: 'nicht eingerichtet' }); return; }
  try {
    if (req.method === 'GET') {
      const erg = await redis(WERKE.map(w => ['HGETALL', 'blick:' + w]));
      const out = {};
      WERKE.forEach((w, i) => { out[w] = zaehler(erg[i].result); });
      res.status(200).json(out);
      return;
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      if (WERKE.indexOf(b.werk) < 0 || ZEICHEN.indexOf(b.zeichen) < 0) {
        res.status(400).json({ fehler: 'ungueltig' });
        return;
      }
      const key = 'blick:' + b.werk;
      const erg = await redis([['HINCRBY', key, b.zeichen, 1], ['HGETALL', key]]);
      res.status(200).json({ werk: b.werk, zaehler: zaehler(erg[1].result) });
      return;
    }
    res.status(405).json({ fehler: 'methode' });
  } catch (e) {
    res.status(500).json({ fehler: 'fehler' });
  }
};
