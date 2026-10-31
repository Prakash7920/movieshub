"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    console.log("Register submitted", values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm text-gray-300">Full name</label>
        <input {...register("name")} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm text-gray-300">Email</label>
        <input {...register("email")} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm text-gray-300">Password</label>
        <input type="password" {...register("password")} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>}
      </div>

      <div>
        <label className="mb-2 block text-sm text-gray-300">Confirm password</label>
        <input type="password" {...register("confirmPassword")} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white" />
        {errors.confirmPassword && <p className="mt-2 text-sm text-red-400">{errors.confirmPassword.message}</p>}
      </div>

      <Button type="submit" className="w-full bg-red-600 hover:bg-red-500">Create account</Button>
    </form>
  );
}
