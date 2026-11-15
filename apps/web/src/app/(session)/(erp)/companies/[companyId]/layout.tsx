// The persistent shell lives above company routes so switching companies
// discards the old scoped subtree instead of retaining a hidden duplicate shell.
export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
