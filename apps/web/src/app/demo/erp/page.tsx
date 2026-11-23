import { Suspense } from "react";
import type { Metadata } from "next";
import { ErpDemo } from "@/features/erp-demo/app";
export const metadata: Metadata = {
  title: "DriveCore | Interactive ERP demo",
  description:
    "A standalone synthetic vehicle-rental ERP prototype. No backend or credentials required.",
};
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-page">
          Opening ERP demo…
        </p>
      }
    >
      <ErpDemo />
    </Suspense>
  );
}
