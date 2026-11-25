import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="page-shell py-16">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-card/80 p-8 md:p-12">
        <p className="text-sm uppercase tracking-[0.2em] text-red-200">Join NexaFilm</p>
        <h1 className="mt-3 text-4xl font-black text-white">Create your account</h1>
        <p className="mt-3 text-gray-400">
          Create a free account to save titles and manage your preferences. Premium checkout and video playback remain subject to their separate release gates.
        </p>

        <div className="mt-8">
          <RegisterForm />
        </div>

        <div className="mt-5 text-center text-sm text-gray-400">
          Already have an account? <Link href="/auth/login" className="text-red-300 hover:text-red-200">Login</Link>
        </div>
      </div>
    </div>
  );
}
