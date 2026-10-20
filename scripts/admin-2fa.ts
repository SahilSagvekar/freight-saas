import { generateTotpSecret, totpAt, totpUri } from "../src/lib/totp";

/**
 * Prints a new secret for the platform console's two-factor sign-in.
 *   npm run admin:2fa -- you@example.com
 * Add the secret to your authenticator app (scan nothing: choose "enter a setup key" and paste it), then set it as
 * PLATFORM_ADMIN_TOTP_SECRET on the server. Keep it out of git and chat. Anyone holding it can make valid codes.
 */
const account = process.argv[2] ?? "admin";
const secret = generateTotpSecret();
console.log("");
console.log("Setup key (paste into your authenticator app):");
console.log(`  ${secret.match(/.{1,4}/g)!.join(" ")}`);
console.log("");
console.log("Or open this address on your phone:");
console.log(`  ${totpUri(secret, account, "Harborline platform admin")}`);
console.log("");
console.log("Then set this environment variable on the server and redeploy:");
console.log(`  PLATFORM_ADMIN_TOTP_SECRET=${secret}`);
console.log("");
console.log(`Check: your app should now be showing ${totpAt(secret)} (it changes every 30 seconds).`);
console.log("");
