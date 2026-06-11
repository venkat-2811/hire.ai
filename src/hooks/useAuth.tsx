/**
 * Authentication hook using Clerk.
 * Provides user state, loading state, and auth methods.
 */
import { useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClerkProvider,
  useAuth as useClerkAuthHook,
  useUser as useClerkUser,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from '@clerk/clerk-react';
import { setAuthTokenGetter } from '@/lib/api';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const CLERK_JS_URL = import.meta.env.VITE_CLERK_JS_URL
  || "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";

function decodeClerkFrontendApi(key: string): string | null {
  try {
    const encoded = key.split('_').slice(2).join('_');
    if (!encoded) return null;
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = atob(padded);
    return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  } catch {
    return null;
  }
}

function getClerkConfigError(key: string | undefined): string | null {
  if (!key) return null;
  const frontendApi = decodeClerkFrontendApi(key);
  if (frontendApi === 'clerk.accounts.dev') {
    return 'VITE_CLERK_PUBLISHABLE_KEY is invalid (it resolves to clerk.accounts.dev instead of your instance domain).';
  }
  return null;
}

const CLERK_CONFIG_ERROR = getClerkConfigError(CLERK_PUBLISHABLE_KEY);

interface ClerkUser {
  id: string;
  email: string | null;
  full_name: string | null;
  image_url: string | null;
}

interface AuthContextValue {
  user: ClerkUser | null;
  loading: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border bg-background p-6">
          <div className="text-lg font-semibold">Clerk is not configured</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your frontend environment and restart the dev server.
          </div>
        </div>
      </div>
    );
  }

  if (CLERK_CONFIG_ERROR) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-lg border bg-background p-6">
          <div className="text-lg font-semibold">Clerk configuration is invalid</div>
          <div className="mt-2 text-sm text-muted-foreground space-y-2">
            <p>{CLERK_CONFIG_ERROR}</p>
            <p>
              Use the exact publishable key from your Clerk dashboard for the same instance as
              <code className="ml-1">CLERK_ISSUER</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ClerkProviderWithRouter>{children}</ClerkProviderWithRouter>;
}

function ClerkProviderWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      clerkJSUrl={CLERK_JS_URL}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      appearance={{
        layout: {
          unsafe_disableDevelopmentModeWarnings: true,
        }
      }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <AuthTokenSetter />
      {children}
    </ClerkProvider>
  );
}

function AuthTokenSetter() {
  const { getToken } = useClerkAuthHook();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  return null;
}

export function useAuth(): AuthContextValue {
  const { isLoaded, isSignedIn, signOut, getToken } = useClerkAuthHook();
  const { user: clerkUser } = useClerkUser();

  const user: ClerkUser | null = clerkUser
    ? {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      full_name: clerkUser.fullName ?? null,
      image_url: clerkUser.imageUrl ?? null,
    }
    : null;

  return {
    user,
    loading: !isLoaded,
    isSignedIn: !!isSignedIn,
    signOut: async () => {
      await signOut();
    },
    getToken,
  };
}

export function useRequireAuth() {
  const { user, loading, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSignedIn) {
      navigate('/sign-in');
    }
  }, [isSignedIn, loading, navigate]);

  return { user, loading };
}

export { SignedIn, SignedOut, RedirectToSignIn };
