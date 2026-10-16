import { LegalShell, contactEmail } from "../legal-shell";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of service" updated="October 2026">
      <p>These terms cover your use of Harborline, a booking and manifest service for ferry and freight operators. By creating an account you agree to them on behalf of your business.</p>
      <h2>Your account</h2>
      <ul>
        <li>You are responsible for the people you add and for keeping sign-in links and passwords private.</li>
        <li>You must give accurate details and be allowed to act for the business you sign up.</li>
      </ul>
      <h2>Your data</h2>
      <p>Bookings, passenger details, manifests and prices you enter belong to you. We use them only to run the service for you. You can export them at any time and ask us to delete them when you leave.</p>
      <h2>Subscriptions and payment</h2>
      <ul>
        <li>Plans renew monthly until cancelled. Cancel any time from the billing page; access continues to the end of the paid period.</li>
        <li>If a payment fails we will email you. After a grace period the account becomes read-only, and your data is kept.</li>
        <li>Online ticket payments are processed by our payment provider. Fees are shown before you turn them on.</li>
      </ul>
      <h2>Safety and your passengers</h2>
      <p>Harborline helps you keep records. It does not replace your legal duties for passenger counts, vessel capacity, dangerous goods or crew rules. You remain responsible for those.</p>
      <h2>Availability</h2>
      <p>We work to keep the service available and the ticket desk keeps working offline, but we cannot promise it will never be interrupted. We are not liable for losses caused by interruptions beyond our reasonable control.</p>
      <h2>Ending the agreement</h2>
      <p>You can stop using the service at any time. We may suspend an account that breaks these terms or is used unlawfully.</p>
      <h2>Contact</h2>
      <p>Questions: <a className="text-brand-700 underline" href={`mailto:${contactEmail()}`}>{contactEmail()}</a></p>
    </LegalShell>
  );
}
