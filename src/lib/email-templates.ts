export type Email = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, paragraphs: string[], button?: { label: string; url: string }, footer?: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p)}</p>`).join("");
  const btn = button
    ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="background:#1d62ad;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${esc(button.label)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;color:#566579">Or paste this into your browser:<br><span style="word-break:break-all">${esc(button.url)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f1b2d">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e3e8ef">
  <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}${btn}
  <p style="margin:18px 0 0;font-size:12px;color:#8492a6">${esc(footer ?? "")}</p></div></body></html>`;
}

export function inviteEmail(p: { name: string; operator: string; inviter: string; url: string; hours: number }): Email {
  const intro = `${p.inviter} added you to ${p.operator} on Harborline.`;
  const note = `The link works once and expires in ${Math.round(p.hours / 24)} days.`;
  return {
    subject: `You've been added to ${p.operator}`,
    text: `Hi ${p.name},\n\n${intro} Choose your password to get started:\n\n${p.url}\n\n${note}\n`,
    html: shell(`Welcome, ${p.name}`, [intro, "Choose your password to get started."], { label: "Choose my password", url: p.url }, note),
  };
}

export function resetEmail(p: { name: string; url: string; hours: number }): Email {
  const note = "If you didn't ask for this, you can ignore this email. Your password stays the same until you use the link.";
  return {
    subject: "Reset your Harborline password",
    text: `Hi ${p.name},\n\nUse this link to choose a new password:\n\n${p.url}\n\nIt works once and expires in ${Math.round(p.hours)} hours.\n${note}\n`,
    html: shell("Reset your password", [`Hi ${p.name}, use the button below to choose a new password. It works once and expires in ${Math.round(p.hours)} hours.`], { label: "Choose a new password", url: p.url }, note),
  };
}

export function welcomeEmail(p: { name: string; operator: string; url: string }): Email {
  return {
    subject: `${p.operator} is ready on Harborline`,
    text: `Hi ${p.name},\n\nYour workspace for ${p.operator} is ready. Choose your password to sign in:\n\n${p.url}\n`,
    html: shell(`${p.operator} is ready`, [`Hi ${p.name}, your workspace is ready.`, "Choose your password to sign in and set up your first vessel and voyage."], { label: "Choose my password", url: p.url }),
  };
}

export function paymentFailedEmail(p: { name: string; operator: string; url: string }): Email {
  return {
    subject: `Payment problem for ${p.operator}`,
    text: `Hi ${p.name},\n\nWe couldn't take your latest Harborline payment for ${p.operator}. Please update your card to keep selling tickets:\n\n${p.url}\n`,
    html: shell("We couldn't take your payment", [`Hi ${p.name}, the latest payment for ${p.operator} didn't go through.`, "Update your card to keep your account active."], { label: "Update payment details", url: p.url }),
  };
}

export function ticketEmail(p: { name: string; operator: string; route: string; when: string; bookingNo: string; url: string; paid: boolean }): Email {
  const note = p.paid ? "Paid in full. Show the QR code on the ticket page when you board." : "Pay at the ticket desk before boarding. Show the QR code on the ticket page.";
  return {
    subject: `Your ticket: ${p.route}, ${p.when}`,
    text: `Hi ${p.name},\n\nYour booking ${p.bookingNo} with ${p.operator} is confirmed.\n${p.route}\n${p.when}\n\nYour ticket: ${p.url}\n\n${note}\n`,
    html: shell(`You're booked: ${p.route}`, [`Hi ${p.name}, your booking ${p.bookingNo} with ${p.operator} is confirmed.`, p.when, note], { label: "Open my ticket", url: p.url }),
  };
}

export function inquiryAlertEmail(p: { operator: string; no: string; name: string; company: string | null; mode: string; route: string; cargo: string; url: string }): Email {
  const who = p.company ? `${p.name} at ${p.company}` : p.name;
  return {
    subject: `New inquiry: ${p.mode}, ${p.route}`,
    text: `${who} sent a quote request to ${p.operator}.\n\n${p.no}\n${p.mode}: ${p.route}\n${p.cargo}\n\nOpen it: ${p.url}\n`,
    html: shell(`New inquiry from ${who}`, [`${p.no} · ${p.mode}`, p.route, p.cargo], { label: "Open the inquiry", url: p.url }),
  };
}

export function inquiryReceivedEmail(p: { name: string; operator: string; message: string; route: string }): Email {
  return {
    subject: `We received your request (${p.route})`,
    text: `Hi ${p.name},\n\n${p.message}\n\n${p.operator}\n`,
    html: shell(`We received your request`, [`Hi ${p.name},`, p.message, `For: ${p.route}`], undefined, p.operator),
  };
}

export function shipmentStatusEmail(p: { operator: string; shipmentNo: string; statusLabel: string; route: string; location?: string | null; note?: string | null; url: string }): Email {
  const where = p.location ? ` (${p.location})` : "";
  const line = `Your shipment ${p.shipmentNo} (${p.route}) is now: ${p.statusLabel}${where}.`;
  const note = p.note ? `Note from ${p.operator}: ${p.note}` : undefined;
  return {
    subject: `${p.shipmentNo}: ${p.statusLabel}`,
    text: `${line}\n\n${note ? `${note}\n\n` : ""}Track it any time:\n${p.url}\n\n${p.operator}\n`,
    html: shell(`Shipment ${p.shipmentNo}: ${p.statusLabel}`, note ? [line, note] : [line], { label: "Track this shipment", url: p.url }, p.operator),
  };
}
