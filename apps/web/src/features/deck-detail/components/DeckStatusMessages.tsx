import { Alert } from "@jaiir320/design-system/components/alert";

export function ErrorBanner({ children }: { children: string }) {
  return (
    <Alert role="alert" className="mb-6">
      {children}
    </Alert>
  );
}

export function StatusMessage({ children }: { children: string }) {
  return (
    <main className="mx-auto w-full p-8">
      <Alert role="alert">{children}</Alert>
    </main>
  );
}
