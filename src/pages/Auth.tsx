import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Studio's dedicated entry remains available during the Appverse SSO migration.
 * New staff identities are provisioned and approved through Core's governed
 * administrator path, not through browser-side Supabase signUp or social OAuth.
 * The backend is still the authorization boundary for every Studio operation.
 */
const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate("/");
    } catch {
      toast.error("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex gradient-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg gradient-gold flex items-center justify-center font-display text-2xl text-primary">
              O
            </div>
            <div>
              <div className="font-display text-2xl">Oasis Baklawa</div>
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">
                Catalogue AI Studio
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-5xl leading-tight mb-4">
            Crafting <span className="gold-text">luxury catalogues</span>, intelligently.
          </h1>
          <p className="opacity-80">
            One studio for product mastery, media, hampers, labels, and AI-assisted catalogue
            creation — built for Oasis teams.
          </p>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-10 top-20 w-72 h-72 rounded-full bg-primary-glow/30 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl mb-2">Employee sign in</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Sign in using your approved Oasis staff account.
          </p>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="signin-email">Employee email</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Need access? Contact your Oasis administrator to receive an invitation
            and an approved AI Studio role. Creating a login does not by itself
            authorize product or catalogue access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
