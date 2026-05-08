import { redirect } from "next/navigation";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const { placed } = await searchParams;

  if (placed) {
    redirect(`/dashboard?tab=orders&placed=${encodeURIComponent(placed)}`);
  }

  redirect("/dashboard?tab=orders");
}
