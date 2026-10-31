import { config } from '../../config';

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** One simple, branded layout for every email: a heading, short paragraphs and one button. */
export function renderEmail({
  heading,
  lines,
  action,
}: {
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
}) {
  const text = [
    heading,
    '',
    ...lines,
    ...(action ? ['', action.label + ': ' + action.url] : []),
    '',
    '— Megha Laundry Equipment',
    config.siteUrl,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#101c2d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;border:1px solid #e3e8ef">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e3e8ef;font-weight:700;color:#0b2540">Megha Laundry Equipment</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 14px;font-size:20px">${escape(heading)}</h1>
${lines.map((line) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55">${escape(line)}</p>`).join('\n')}
${action ? `<p style="margin:20px 0 0"><a href="${escape(action.url)}" style="display:inline-block;padding:11px 18px;border-radius:7px;background:#0769c9;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px">${escape(action.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e3e8ef;font-size:12px;color:#64748b">This email was sent by Megha Laundry Equipment · <a href="${escape(config.siteUrl)}" style="color:#64748b">${escape(config.siteUrl.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
