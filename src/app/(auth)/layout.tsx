export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Simple layout without header/footer for auth pages
  return <>{children}</>;
}
