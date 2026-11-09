import { Alert } from "@jaiir320/design-system/components/alert";
import { Button } from "@jaiir320/design-system/components/button";
import { Card } from "@jaiir320/design-system/components/card";
import { Field, FieldLabel } from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";
import { Spinner } from "@jaiir320/design-system/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@jaiir320/design-system/components/toggle-group";
import { useReducer } from "react";
import type { FormEvent } from "react";
import { authClient } from "#/lib/auth-client";

type Mode = "sign-in" | "sign-up";

type AuthState = {
  mode: Mode;
  email: string;
  password: string;
  errorMessage: string | null;
  isSubmitting: boolean;
};

const initialAuthState: AuthState = {
  mode: "sign-up",
  email: "",
  password: "",
  errorMessage: null,
  isSubmitting: false,
};

export function AuthPage() {
  const [state, setState] = useReducer(
    (current: AuthState, next: Partial<AuthState>) => ({ ...current, ...next }),
    initialAuthState,
  );
  const { mode, email, password, errorMessage, isSubmitting } = state;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return;
    }

    setState({ isSubmitting: true, errorMessage: null });

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          email: trimmedEmail,
          password,
          name: trimmedEmail.split("@")[0] || "User",
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      } else {
        const result = await authClient.signIn.email({
          email: trimmedEmail,
          password,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      window.location.assign("/decks");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      if (mode === "sign-in" && message === "Invalid email or password") {
        setState({
          errorMessage: "No account was found for that email/password. Try Sign up first.",
        });
      } else {
        setState({ errorMessage: message });
      }
    } finally {
      setState({ isSubmitting: false });
    }
  }

  const title = mode === "sign-in" ? "Sign in" : "Create account";
  const subtitle =
    mode === "sign-in"
      ? "Use your email and password to access your decks."
      : "Create an account to start building and saving decks.";

  return (
    <main className="flex h-full items-center justify-center px-6 py-12">
      <Card
        padding="xl"
        className="w-full max-w-md rounded-3xl bg-surface-glass/90 shadow-2xl shadow-black/40"
      >
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-brand text-highlight">DeckDiff</p>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-subtle-foreground">{subtitle}</p>
        </div>

        <ToggleGroup<Mode>
          aria-label="Authentication mode"
          variant="segmented"
          value={[mode]}
          onValueChange={(value) => {
            if (value[0]) setState({ mode: value[0] });
          }}
          className="mt-6"
        >
          <ToggleGroupItem<Mode> value="sign-in">Sign in</ToggleGroupItem>
          <ToggleGroupItem<Mode> value="sign-up">Sign up</ToggleGroupItem>
        </ToggleGroup>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input
              inputSize="lg"
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onValueChange={(value) => setState({ email: value })}
              placeholder="you@example.com"
              required
            />
          </Field>

          <Field>
            <FieldLabel>Password</FieldLabel>
            <Input
              inputSize="lg"
              id="auth-password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onValueChange={(value) => setState({ password: value })}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </Field>

          {errorMessage ? (
            <Alert tone="destructive" role="alert">
              {errorMessage}
            </Alert>
          ) : null}

          <Button type="submit" variant="default" disabled={isSubmitting} className="w-full py-3">
            {isSubmitting ? <Spinner /> : null}
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
