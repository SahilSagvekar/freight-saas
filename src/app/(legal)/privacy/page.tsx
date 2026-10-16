import { LegalShell, contactEmail } from "../legal-shell";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="October 2026">
      <p>This explains what Harborline stores and why. We keep it short because we collect little.</p>
      <h2>What we store</h2>
      <ul>
        <li><strong>Team members:</strong> name, email, role, and a salted hash of the password (we cannot read it).</li>
        <li><strong>Bookings:</strong> passenger and contact names, phone numbers, vehicle plates and cargo descriptions that your staff or customers enter.</li>
        <li><strong>Records:</strong> an audit trail of who changed what, and basic sign-in throttling counters.</li>
        <li><strong>Payments:</strong> card details go straight to our payment provider and never touch our servers.</li>
      </ul>
      <h2>Who can see it</h2>
      <p>Each operator&apos;s data is separated from every other operator&apos;s in the database itself. Only people your owner adds can see it. We access it only to fix a problem you ask us to look at.</p>
      <h2>Who we share it with</h2>
      <p>Service providers that run the product for us: hosting, email delivery, payment processing and error reporting. Error reports contain no passwords, cookies or booking details.</p>
      <h2>How long we keep it</h2>
      <p>While your account is active. After you leave, we delete your data on request, and from backups within 30 days.</p>
      <h2>Your rights</h2>
      <p>You can ask us to export, correct or delete your data. Passengers should ask the operator they booked with, who is responsible for their booking records; we will help the operator respond.</p>
      <h2>Contact</h2>
      <p><a className="text-brand-700 underline" href={`mailto:${contactEmail()}`}>{contactEmail()}</a></p>
    </LegalShell>
  );
}
