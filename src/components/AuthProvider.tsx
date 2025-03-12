
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from './ui/spinner';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  user: any | null;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => {},
  user: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Set to false to skip loading state
  const [user, setUser] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // For demonstration, we're using mock authentication
    console.log("AuthProvider initialized with mock authentication");
    // Set isAuthenticated to true for demo purposes
    setIsAuthenticated(true);
    setUser({ id: 'mock-user-id', email: 'demo@example.com' });
    
    // Comment out the actual Supabase auth checks for now
    // This will be uncommented when Supabase is properly set up
    /*
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUser(session?.user || null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      setIsAuthenticated(!!session);
      setUser(session?.user || null);
      
      if (!session && window.location.pathname !== '/auth') {
        navigate('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    */
  }, [navigate]);

  const signOut = async () => {
    try {
      // Mock sign out
      console.log("Mock sign out");
      setIsAuthenticated(false);
      setUser(null);
      navigate('/auth');
      
      // Actual Supabase sign out (commented out for now)
      // await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // No loading spinner needed with mock auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signOut, user }}>
      {children}
    </AuthContext.Provider>
  );
};
