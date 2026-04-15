import { LogOut } from 'lucide-react'
import { HeadContent, Scripts, createRootRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Analytics } from '@vercel/analytics/react'
import { authClient } from '#/lib/auth-client'
import appCss from '../styles.css?url'
import { FeedbackButton } from '../components/FeedbackButton'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'DeckDiffer',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-zinc-950 font-sans antialiased text-zinc-100 [overflow-wrap:anywhere]">
        <AppHeader />
        {children}
        <FeedbackGate />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Analytics />
        <Scripts />
      </body>
    </html>
  )
}

function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  async function handleSignOut() {
    await authClient.signOut()
    await navigate({ to: '/auth' })
  }

  const isAuthPage = location.pathname === '/auth'

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">DeckDiffer</p>
          {!isAuthPage && session ? <p className="text-sm text-zinc-400">{session.user.email}</p> : null}
        </div>

        {!isAuthPage && session ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : isPending ? <div className="h-10 w-24" /> : null}
      </div>
    </header>
  )
}

function FeedbackGate() {
  const location = useLocation()

  if (location.pathname === '/auth') {
    return null
  }

  return <FeedbackButton />
}
