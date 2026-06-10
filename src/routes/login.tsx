import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { login, register, forgotPassword, updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { loginWithTelegram } from "@/lib/telegramAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton";
import { Logo } from "@/components/site/Logo";
import type { TelegramUser } from "@/lib/telegramAuth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — hairora" }] }),
  component: LoginPage,
});

type View = "login" | "register" | "forgot" | "forgot-sent" | "reset";

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25 },
};

function LoginPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // forgot fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [sentTo, setSentTo] = useState("");

  // reset fields
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");

  // Detect password reset callback (?code= from Supabase email link)
  useEffect(() => {
    if (!supabase) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          setView("reset");
          // Clean the URL so refresh doesn't re-trigger
          window.history.replaceState({}, "", window.location.pathname);
        }
      });
      return;
    }
    // Also handle implicit flow (hash-based recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("reset");
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const goTo = (v: View) => {
    setIsLoading(false);
    setView(v);
  };

  // ── Login ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(email, password);
    if (result.success && result.user) {
      toast.success(`Welcome back, ${result.user.name}!`);
      navigate({ to: result.user.role === "admin" ? "/admin" : "/" });
    } else {
      toast.error(result.error || "Login failed");
      setIsLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    const result = await register(regEmail, regPassword, regName);
    if (result.success && result.user) {
      toast.success(`Welcome, ${result.user.name}!`);
      navigate({ to: "/" });
    } else {
      toast.error(result.error || "Registration failed");
      setIsLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await forgotPassword(forgotEmail);
    setIsLoading(false);
    if (result.success) {
      setSentTo(forgotEmail);
      setView("forgot-sent");
    } else {
      toast.error(result.error || "Failed to send reset email");
    }
  };

  // ── Telegram ───────────────────────────────────────────
  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setIsLoading(true);
    const result = await loginWithTelegram(telegramUser);
    if (result.success && result.user) {
      toast.success(`Welcome, ${result.user.name}!`);
      navigate({ to: result.user.role === "admin" ? "/admin" : "/" });
    } else {
      toast.error(result.error || "Telegram login failed");
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newConfirm) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setIsLoading(true);
    const result = await updatePassword(newPassword);
    setIsLoading(false);
    if (result.success) {
      toast.success("Password updated! Please sign in.");
      goTo("login");
    } else {
      toast.error(result.error || "Failed to update password");
    }
  };

  const viewMeta: Record<View, { title: string; desc: string }> = {
    login: { title: "Welcome back", desc: "Sign in to your account" },
    register: { title: "Create account", desc: "Join hairora today" },
    forgot: { title: "Reset password", desc: "We'll send a reset link to your email" },
    "forgot-sent": { title: "Check your email", desc: `Reset link sent to ${sentTo}` },
    reset: { title: "Set new password", desc: "Choose a strong password for your account" },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <Logo className="h-14 w-auto" />
            </div>
            <CardTitle className="text-2xl">{viewMeta[view].title}</CardTitle>
            <CardDescription>{viewMeta[view].desc}</CardDescription>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              {/* ── LOGIN ── */}
              {view === "login" && (
                <motion.div key="login" {...slide}>
                  <Tabs defaultValue="email" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="email" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="telegram" className="gap-2">
                        <TelegramIcon className="h-4 w-4" />
                        Telegram
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="email" className="space-y-4">
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <button
                              type="button"
                              onClick={() => goTo("forgot")}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              autoComplete="current-password"
                              className="h-11 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <Button type="submit" className="w-full h-11 rounded-full" disabled={isLoading}>
                          {isLoading ? <Spinner /> : "Sign in"}
                        </Button>
                      </form>

                      {!isSupabaseConfigured && (
                        <div className="rounded-lg border bg-muted/50 p-4">
                          <p className="text-sm font-medium mb-3">Demo Mode — Quick Login</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" size="sm"
                              onClick={() => { setEmail("admin@shop.com"); setPassword("admin123"); }}>
                              Admin Demo
                            </Button>
                            <Button type="button" variant="outline" size="sm"
                              onClick={() => { setEmail("user@shop.com"); setPassword("user123"); }}>
                              User Demo
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="telegram">
                      <div className="space-y-4">
                        <div className="text-center space-y-2">
                          <div className="w-16 h-16 mx-auto bg-[#0088cc]/10 rounded-full flex items-center justify-center">
                            <TelegramIcon className="h-8 w-8 text-[#0088cc]" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Sign in with your Telegram account for quick access
                          </p>
                        </div>
                        <TelegramLoginButton
                          onAuth={handleTelegramAuth}
                          onError={(err) => toast.error(err)}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => goTo("register")}
                      className="font-medium text-foreground hover:underline"
                    >
                      Create account
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── REGISTER ── */}
              {view === "register" && (
                <motion.div key="register" {...slide}>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full name</Label>
                      <Input
                        id="reg-name"
                        placeholder="Your name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="your@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm">Confirm password</Label>
                      <div className="relative">
                        <Input
                          id="reg-confirm"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat your password"
                          value={regConfirm}
                          onChange={(e) => setRegConfirm(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-11 rounded-full" disabled={isLoading}>
                      {isLoading ? <Spinner /> : "Create account"}
                    </Button>
                  </form>

                  <p className="text-center text-sm text-muted-foreground mt-6">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => goTo("login")}
                      className="font-medium text-foreground hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── FORGOT ── */}
              {view === "forgot" && (
                <motion.div key="forgot" {...slide}>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="your@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="h-11"
                      />
                    </div>

                    {!isSupabaseConfigured && (
                      <p className="text-xs text-muted-foreground rounded-md bg-muted p-3">
                        Demo mode — no real email will be sent.
                      </p>
                    )}

                    <Button type="submit" className="w-full h-11 rounded-full" disabled={isLoading}>
                      {isLoading ? <Spinner /> : "Send reset link"}
                    </Button>
                  </form>

                  <p className="text-center text-sm text-muted-foreground mt-6">
                    <button
                      type="button"
                      onClick={() => goTo("login")}
                      className="font-medium text-foreground hover:underline"
                    >
                      Back to sign in
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── RESET PASSWORD ── */}
              {view === "reset" && (
                <motion.div key="reset" {...slide}>
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-confirm">Confirm new password</Label>
                      <div className="relative">
                        <Input
                          id="new-confirm"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat new password"
                          value={newConfirm}
                          onChange={(e) => setNewConfirm(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-11 rounded-full" disabled={isLoading}>
                      {isLoading ? <Spinner /> : "Update password"}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ── FORGOT SENT ── */}
              {view === "forgot-sent" && (
                <motion.div key="forgot-sent" {...slide} className="text-center space-y-6 py-4">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                  <div className="space-y-2">
                    <p className="font-medium">Reset link sent!</p>
                    <p className="text-sm text-muted-foreground">
                      Check your inbox at <span className="font-medium text-foreground">{sentTo}</span> and
                      follow the link to reset your password.
                    </p>
                    {!isSupabaseConfigured && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-md p-3 mt-2">
                        Demo mode — no real email was sent.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full w-full"
                    onClick={() => goTo("login")}
                  >
                    Back to sign in
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
    />
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
