/** Where an operator sails, which sets their currency, language and time zone. Editable later in Settings (time zone, language). */
export type Region = { code: string; name: string; currency: string; timeZone: string; locale: string };

export const REGIONS: Region[] = [
  { code: "BS", name: "Bahamas", currency: "BSD", timeZone: "America/Nassau", locale: "en-BS" },
  { code: "BD", name: "Bangladesh", currency: "BDT", timeZone: "Asia/Dhaka", locale: "en-BD" },
  { code: "CA", name: "Canada", currency: "CAD", timeZone: "America/Vancouver", locale: "en-CA" },
  { code: "HR", name: "Croatia", currency: "EUR", timeZone: "Europe/Zagreb", locale: "hr-HR" },
  { code: "DK", name: "Denmark", currency: "DKK", timeZone: "Europe/Copenhagen", locale: "da-DK" },
  { code: "FJ", name: "Fiji", currency: "FJD", timeZone: "Pacific/Fiji", locale: "en-FJ" },
  { code: "GR", name: "Greece", currency: "EUR", timeZone: "Europe/Athens", locale: "el-GR" },
  { code: "IN", name: "India", currency: "INR", timeZone: "Asia/Kolkata", locale: "en-IN" },
  { code: "ID", name: "Indonesia", currency: "IDR", timeZone: "Asia/Jakarta", locale: "id-ID" },
  { code: "IE", name: "Ireland", currency: "EUR", timeZone: "Europe/Dublin", locale: "en-IE" },
  { code: "IT", name: "Italy", currency: "EUR", timeZone: "Europe/Rome", locale: "it-IT" },
  { code: "JM", name: "Jamaica", currency: "JMD", timeZone: "America/Jamaica", locale: "en-JM" },
  { code: "KE", name: "Kenya", currency: "KES", timeZone: "Africa/Nairobi", locale: "en-KE" },
  { code: "MV", name: "Maldives", currency: "MVR", timeZone: "Indian/Maldives", locale: "en" },
  { code: "MY", name: "Malaysia", currency: "MYR", timeZone: "Asia/Kuala_Lumpur", locale: "en-MY" },
  { code: "NZ", name: "New Zealand", currency: "NZD", timeZone: "Pacific/Auckland", locale: "en-NZ" },
  { code: "NG", name: "Nigeria", currency: "NGN", timeZone: "Africa/Lagos", locale: "en-NG" },
  { code: "NO", name: "Norway", currency: "NOK", timeZone: "Europe/Oslo", locale: "nb-NO" },
  { code: "PH", name: "Philippines", currency: "PHP", timeZone: "Asia/Manila", locale: "en-PH" },
  { code: "LK", name: "Sri Lanka", currency: "LKR", timeZone: "Asia/Colombo", locale: "en-LK" },
  { code: "SE", name: "Sweden", currency: "SEK", timeZone: "Europe/Stockholm", locale: "sv-SE" },
  { code: "TZ", name: "Tanzania", currency: "TZS", timeZone: "Africa/Dar_es_Salaam", locale: "en-TZ" },
  { code: "TH", name: "Thailand", currency: "THB", timeZone: "Asia/Bangkok", locale: "en-TH" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timeZone: "Europe/London", locale: "en-GB" },
  { code: "US", name: "United States", currency: "USD", timeZone: "America/New_York", locale: "en-US" },
  { code: "VN", name: "Vietnam", currency: "VND", timeZone: "Asia/Ho_Chi_Minh", locale: "vi-VN" },
];

export const regionByCode = (code: string) => REGIONS.find((r) => r.code === code);
