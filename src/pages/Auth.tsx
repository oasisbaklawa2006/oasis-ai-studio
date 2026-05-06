import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
        </div>
      </div>
    </div>
  );
};

export default Auth;
