import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { LoginPageGuard } from "@/components/auth/login-page-guard";

export default function LoginPage() {
  return (
    <div className="page-shell py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-card/80 lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-gradient-to-br from-red-900/50 to-black p-8 md:p-12">
          <p className="mb-3 text-sm uppercase tracking-[0.22em] text-red-200">Welcome back</p>
          <h1 className="text-4xl font-black text-white">Login to NexaFilm</h1>
          <p className="mt-4 max-w-md text-gray-300">
            Sign in with your registered email address and password to manage your account, saved titles, and preferences.
          </p>
          <p className="mt-5 text-xs leading-5 text-gray-500">
            Email and password sign-in is currently supported. Other sign-in methods are not enabled yet.
          </p>
        </div>

        <div className="p-8 md:p-12">
          <Suspense fallback={<div className="min-h-64" aria-label="Loading login form" />}>
            <LoginPageGuard />
            <LoginForm />
          </Suspense>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
            <Link href="/auth/register" className="hover:text-white">Create account</Link>
            <Link href="/auth/forgot-password" className="hover:text-white">Forgot password?</Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Need to verify your email?{" "}
            <Link href="/auth/resend-verification" className="text-red-300 hover:text-red-200">
              Resend verification email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
