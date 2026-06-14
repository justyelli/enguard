import { prisma } from "@/lib/prisma";
import { todayKey, type WorkbookData } from "@/lib/workbook";
import WorkbookView from "@/components/WorkbookView";

export const dynamic = "force-dynamic";

export default async function WorkbookPage() {
  const day = todayKey();
  const wb = await prisma.workbook.findUnique({ where: { day } });

  const initial = wb
    ? {
        data: JSON.parse(wb.answers) as WorkbookData,
        completed: wb.completed,
      }
    : null;

  return <WorkbookView initial={initial} />;
}
