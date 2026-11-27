import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import CreatorStudio from "@/components/creator/creator-studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreatorStudioPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/login?callbackUrl=%2Fcreator%2Fstudio");
  return <CreatorStudio />;
}
