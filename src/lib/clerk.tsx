/**
 * Clerk authentication provider and hooks for the frontend.
 */
import { ClerkProvider, useAuth as useClerkAuth, useUser, SignIn, SignUp } from '@clerk/clerk-react';
import { ReactNode } from 'react';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

interface ClerkAuthProviderProps {
  children: ReactNode;
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }
  
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}

export { useClerkAuth, useUser, SignIn, SignUp };

/**
 * Hook to get the current user's auth token for API calls.
 */
export function useAuthToken() {
  const { getToken } = useClerkAuth();
  
  return async (): Promise<string | null> => {
    try {
      const token = await getToken();
      return token;
    } catch {
      return null;
    }
  };
}
