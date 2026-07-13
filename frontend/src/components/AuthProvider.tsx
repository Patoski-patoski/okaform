import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import bs58 from 'bs58';
import { useWallet } from './WalletProvider';
import { setAccessToken } from '@/lib/api';
import {
  getNonce,
  verifySignature,
  getMe,
  logout as apiLogout,
  type UserProfile,
} from '@/lib/auth';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, signMessage } = useWallet();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const wallet = publicKey?.toBase58() ?? null;

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async () => {
    if (!wallet || !signMessage) return;

    setIsLoading(true);
    try {
      const { message } = await getNonce(wallet);
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      const result = await verifySignature(wallet, message, signature);
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (err) {
      setAccessToken(null);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, signMessage]);

  useEffect(() => {
    if (!connected || !wallet) {
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    const tryRestore = async () => {
      try {
        const profile = await getMe();
        setUser(profile);
      } catch {
        if (wallet && signMessage) {
          await login();
        }
      } finally {
        setIsLoading(false);
      }
    };

    void tryRestore();
  }, [connected, wallet]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
