import { LiveInvoiceDetailPage } from "@/features/finance/invoice-detail-page";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <LiveInvoiceDetailPage invoiceId={invoiceId} />;
}
