import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const emailSchema = z.string().email();
const pwdSchema = z.string().min(6, "At least 6 characters");

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Storefront" }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/" });
    });
  }, [router]);

  const signIn = async () => {
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    router.navigate({ to: "/" });
  };

  const signUp = async () => {
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email");
    const pwd = pwdSchema.safeParse(password);
    if (!pwd.success) return toast.error(pwd.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  };

  const forgot = async () => {
    if (!emailSchema.safeParse(email).success) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Check your email for the reset link.");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in or create an account.</p>
        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={loading} onClick={signIn}>Sign in</Button>
            <button onClick={forgot} className="text-xs text-muted-foreground hover:underline">Forgot password?</button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-4 pt-4">
            <div className="space-y-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full" disabled={loading} onClick={signUp}>Create account</Button>
          </TabsContent>
        </Tabs>
      </div>
      <Link to="/" className="mt-6 text-sm text-muted-foreground hover:underline">← Back home</Link>
    </div>
  );
}