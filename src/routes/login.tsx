import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { login } from "@/lib/auth";
import { loginWithTelegram } from "@/lib/telegramAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton";
import type { TelegramUser } from "@/lib/telegramAuth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — hairora" }] }),
  component: LoginPage,
});

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("email");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success && result.user) {
      toast.success(`Welcome back, ${result.user.name}!`);
      const redirectTo = result.user.role === "admin" ? "/admin" : "/";
      setTimeout(() => {
        navigate({ to: redirectTo });
      }, 600);
    } else {
      toast.error(result.error || "Login failed");
      setIsLoading(false);
    }
  };

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setIsLoading(true);

    const result = await loginWithTelegram(telegramUser);

    if (result.success && result.user) {
      toast.success(`Welcome, ${result.user.name}!`, {
        icon: "📱",
      });
      const redirectTo = result.user.role === "admin" ? "/admin" : "/";
      setTimeout(() => {
        navigate({ to: redirectTo });
      }, 600);
    } else {
      toast.error(result.error || "Telegram login failed");
      setIsLoading(false);
    }
  };

  const handleTelegramError = (error: string) => {
    toast.error(error);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back to home */}
      <div className="p-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>

      {/* Main content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex items-center justify-center px-4 py-12"
      >
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <motion.div variants={itemVariants}>
              <div className="flex justify-center mb-4">
                <img src="/logo.png" alt="hairora" className="h-10 w-auto" />
              </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
            </motion.div>
            <motion.div variants={itemVariants}>
              <CardDescription>Sign in to your account to continue</CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="email" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="telegram" className="gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  Telegram
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-4">
                <motion.form
                  variants={itemVariants}
                  onSubmit={handleEmailSubmit}
                  className="space-y-4"
                >
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
                      <Link
                        to="/account"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 rounded-full" disabled={isLoading}>
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </motion.form>

                {/* Demo Mode Helper */}
                {!isSupabaseConfigured && (
                  <motion.div
                    variants={itemVariants}
                    className="mt-6 rounded-lg border bg-muted/50 p-4"
                  >
                    <p className="text-sm font-medium mb-3">Demo Mode - Quick Login</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEmail("admin@shop.com");
                          setPassword("admin123");
                        }}
                      >
                        Admin Demo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEmail("user@shop.com");
                          setPassword("user123");
                        }}
                      >
                        User Demo
                      </Button>
                    </div>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="telegram" className="space-y-4">
                <motion.div variants={itemVariants} className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-[#0088cc]/10 rounded-full flex items-center justify-center">
                      <svg
                        className="h-8 w-8 text-[#0088cc]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sign in with your Telegram account for quick access
                    </p>
                  </div>

                  <TelegramLoginButton onAuth={handleTelegramAuth} onError={handleTelegramError} />

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have a Telegram account?{" "}
                      <a
                        href="https://telegram.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0088cc] hover:underline"
                      >
                        Get Telegram
                      </a>
                    </p>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </motion.div>

            {/* Register link */}
            <motion.div variants={itemVariants} className="text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/admin/login" className="font-medium text-foreground hover:underline">
                  Create one
                </Link>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
