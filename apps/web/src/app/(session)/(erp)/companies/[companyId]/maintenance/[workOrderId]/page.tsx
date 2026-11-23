import { LiveWorkOrderDetailPage } from "@/features/maintenance/maintenance-page";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}) {
  const { workOrderId } = await params;
  return <LiveWorkOrderDetailPage workOrderId={workOrderId} />;
}
