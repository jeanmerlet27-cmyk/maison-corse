export const metadata = {
  title: "Maison Corse — Réservations"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", margin: 0, background: "#fafafa" }}>
        {children}
      </body>
    </html>
  );
}
