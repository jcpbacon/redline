export const metadata = {
  title: "Redline",
  description: "Know what you're signing before you sign it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
