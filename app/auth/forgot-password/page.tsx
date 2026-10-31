import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="page-shell py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-card/80 p-8 md:p-12">
        <p className="text-sm uppercase tracking-[0.2em] text-red-200">Reset access</p>
        <h1 className="mt-3 text-4xl font-black text-white">Forgot password?</h1>
        <p className="mt-3 text-gray-400">We’ll send a secure reset link to your registered email address.</p>

        <div className="mt-8">
          <ForgotPasswordForm />
        </div>

        <div className="mt-5 text-center text-sm text-gray-400">
          Back to <Link href="/auth/login" className="text-red-300 hover:text-red-200">Login</Link>
        </div>
        <div className="mt-6">
          <Button variant="outline" className="w-full">Request OTP instead</Button>
        </div>
      </div>
    </div>
  );
}
