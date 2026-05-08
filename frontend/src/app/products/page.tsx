import { ProductGrid } from "@/components/customer/product-grid";
import { AppShell, PageHeader } from "@/components/layout/app-shell";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; filters?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};

  return (
    <AppShell>
      <PageHeader title="Shop NovaMart" eyebrow="Curated catalog">
        Browse everyday essentials across tech, home, kitchen, fitness, and travel. Add items to your cart and checkout when you are ready.
      </PageHeader>
      <ProductGrid
        title="All products"
        subtitle="Filter by category, seller, price, and search terms to find the right pick faster."
        initialQuery={resolvedSearchParams.q || ""}
        initialFiltersOpen={resolvedSearchParams.filters === "1"}
      />
    </AppShell>
  );
}
