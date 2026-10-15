// Independent date formatting used by the validators (deliberately NOT shared with js/i18n.js,
// so a bug in the site formatter cannot hide itself).
const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmt(iso, lang) {
  if (iso === 'present') return { pt: 'Atual', es: 'Actualidad' }[lang] || 'Present';
  const [y, m] = iso.split('-');
  if (!m) return y;
  if (lang === 'pt') return `${PT[+m - 1]}/${y}`;
  if (lang === 'es') return `${ES[+m - 1]} ${y}`;
  return `${EN[+m - 1]} ${y}`;
}
export function range(start, end, lang) {
  return end ? `${fmt(start, lang)} – ${fmt(end, lang)}` : fmt(start, lang);
}
