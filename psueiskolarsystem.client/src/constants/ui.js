// Shared inline style for compact filter controls on list pages
// (previously duplicated in several pages as `ctlStyle`).
//
// Only `paddingLeft` is set, never the `padding` shorthand: a shorthand also sets
// padding-right, which wipes out the 40px gutter `select.clay-input` reserves for its
// chevron — the option text then runs underneath the arrow and gets clipped ("Semeste▾1").
// Vertical padding is handled in index.css, where single-line controls zero it out so a
// fixed height never shears the glyphs.
export const ctlStyle = { height: 36, minHeight: 36, fontSize: 12.5, paddingLeft: 12 };

/**
 * A Date as the YYYY-MM-DD an <input type="date"> expects, in the viewer's own calendar.
 * `toISOString().split('T')[0]` is the *UTC* date, which in Manila is still yesterday until
 * 8 AM — so "today" defaults were a day behind every morning.
 */
export function localDateInput(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
