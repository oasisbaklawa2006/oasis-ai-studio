import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/legacy/lovable";

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message); else navigate("/");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } }
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Account created. You can sign in.");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message ?? "Sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    navigate("/");
  };
  const handleGoogle = () => handleOAuth("google");
  const handleApple = () => handleOAuth("apple");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex gradient-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg gradient-gold flex items-center justify-center font-display text-2xl text-primary">O</div>
            <div>
              <div className="font-display text-2xl">Oasis Baklawa</div>
              <div className="text-xs uppercase tracking-[0.25em] opacity-70">Catalogue AI Studio</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-5xl leading-tight mb-4">
            Crafting <span className="gold-text">luxury catalogues</span>, intelligently.
          </h1>
          <p className="opacity-80">
            One studio for product mastery, media, hampers, labels, and AI-assisted catalogue creation —
            built for Oasis teams.
          </p>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-10 top-20 w-72 h-72 rounded-full bg-primary-glow/30 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl mb-2">Welcome</h2>
          <p className="text-muted-foreground mb-8 text-sm">Sign in to your Oasis Studio account.</p>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "Sign In"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-6">
                <div><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "Create Account"}</Button>
                <p className="text-xs text-muted-foreground">First registered user becomes the Owner. Subsequent users are assigned the Sales role and can be promoted.</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogle}>
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/></svg>
              Continue with Google
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleApple}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.23-1.18 3.04-.81.86-2.13 1.52-3.21 1.43-.13-1.13.42-2.31 1.16-3.06.83-.85 2.24-1.49 3.23-1.41zM20.5 17.36c-.55 1.27-.81 1.84-1.52 2.96-.99 1.56-2.39 3.5-4.13 3.52-1.54.02-1.94-1-4.04-.99-2.1.01-2.54 1.01-4.08.99-1.74-.02-3.06-1.78-4.05-3.34C-.05 16.16-.34 11.07 1.4 8.32c1.24-1.96 3.2-3.11 5.04-3.11 1.88 0 3.06 1.03 4.61 1.03 1.5 0 2.42-1.03 4.59-1.03 1.65 0 3.4.9 4.64 2.46-4.08 2.24-3.42 8.07.22 9.69z"/></svg>
              Continue with Apple
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
