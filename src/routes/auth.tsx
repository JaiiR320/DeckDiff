import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { authClient } from '#/lib/auth-client'
import { getCurrentSession } from '#/server/session'

export const Route = createFileRoute('/auth')({
  beforeLoad: async () => {
    const session = await getCurrentSession()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: AuthPage,
})

type Mode = 'sign-in' | 'sign-up'

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          email: trimmedEmail,
          password,
          name: trimmedEmail.split('@')[0] || 'User',
        })

        if (result.error) {
          throw new Error(result.error.message)
        }
      } else {
        const result = await authClient.signIn.email({
          email: trimmedEmail,
          password,
        })

        if (result.error) {
          throw new Error(result.error.message)
        }
      }

      await navigate({ to: '/' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.'
      if (mode === 'sign-in' && message === 'Invalid email or password') {
        setErrorMessage('No account was found for that email/password. Try Sign up first.')
      } else {
        setErrorMessage(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const subtitle =
    mode === 'sign-in'
      ? 'Use your email and password to access your decks.'
      : 'Create an account to start building and saving decks.'

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/90 p-8 shadow-2xl shadow-black/40">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">DeckDiffer</p>
          <h1 className="text-3xl font-semibold text-zinc-100">{title}</h1>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'sign-in' ? 'bg-cyan-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === 'sign-up' ? 'bg-cyan-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-zinc-400" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
