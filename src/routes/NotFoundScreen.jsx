import { Link } from "@/lib/router";

export default function NotFoundScreen() {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-foreground text-7xl font-bold">404</h1>
        <h2 className="text-foreground mt-4 text-xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
