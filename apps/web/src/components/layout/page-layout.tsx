export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-page">
      {children}
    </div>
  );
}
