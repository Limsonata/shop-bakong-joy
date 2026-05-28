export function Footer() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto max-w-7xl px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} Storefront. Crafted with care.
      </div>
    </footer>
  );
}