"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (values: z.infer<typeof forgotPasswordSchema>) => {
    console.log("Forgot password request", values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm text-gray-300">Email</label>
        <input {...register("email")} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>}
      </div>
      <Button type="submit" className="w-full bg-red-600 hover:bg-red-500">Send reset link</Button>
    </form>
  );
}
