import qrcode from "qrcode-generator";

/** A QR code drawn as inline SVG, so it prints sharply and needs no image hosting. Rendered on the server. */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 3;
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + quiet},${r + quiet}h1v1h-1z`);
  }
  const dim = n + quiet * 2;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect width={dim} height={dim} fill="#fff" />
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}
