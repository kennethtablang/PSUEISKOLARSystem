// Shared inline style for compact filter controls on list pages
// (previously duplicated in several pages as `ctlStyle`).
//
// Only `paddingLeft` is set, never the `padding` shorthand: a shorthand also sets
// padding-right, which wipes out the 40px gutter `select.clay-input` reserves for its
// chevron — the option text then runs underneath the arrow and gets clipped ("Semeste▾1").
// Vertical padding is handled in index.css, where single-line controls zero it out so a
// fixed height never shears the glyphs.
export const ctlStyle = { height: 36, minHeight: 36, fontSize: 12.5, paddingLeft: 12 };
