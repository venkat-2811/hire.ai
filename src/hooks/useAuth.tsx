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

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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

  return <ClerkProviderWithRouter>{children}</ClerkProviderWithRouter>;
}

function ClerkProviderWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
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
