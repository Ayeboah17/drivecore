import { LivePurchaseOrderDetailPage } from "@/features/procurement/procurement-page";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ purchaseOrderId: string }>;
}) {
  const { purchaseOrderId } = await params;
  return <LivePurchaseOrderDetailPage purchaseOrderId={purchaseOrderId} />;
}
