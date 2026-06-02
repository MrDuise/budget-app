import { db } from "@/lib/db";
import { addDays, startOfDay } from "date-fns";

export async function maybeArchive(transactionId: string) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: { scheduleDates: true, occurrenceOverrides: true },
  });

  if (!transaction || !transaction.isFinite || transaction.status === "archived") return;

  let totalExpected = 0;

  if (transaction.scheduleDates.length > 0) {
    totalExpected = transaction.scheduleDates.length;
  } else if (transaction.intervalDays && transaction.specificDate) {
    if (transaction.maxOccurrences) {
      totalExpected = transaction.maxOccurrences;
    } else if (transaction.endDate) {
      let anchor = startOfDay(transaction.specificDate);
      const end = startOfDay(transaction.endDate);
      while (anchor <= end) {
        totalExpected++;
        anchor = addDays(anchor, transaction.intervalDays);
      }
    }
  }

  if (totalExpected === 0) return;

  const terminal = new Set(["paid", "skipped"]);
  const doneCount = transaction.occurrenceOverrides.filter((o) =>
    terminal.has(o.status)
  ).length;

  const scheduleDone =
    transaction.scheduleDates.length > 0
      ? transaction.scheduleDates.filter((sd) =>
          transaction.occurrenceOverrides.some(
            (o) =>
              startOfDay(o.occurrenceDate).getTime() === startOfDay(sd.date).getTime() &&
              terminal.has(o.status)
          )
        ).length
      : doneCount;

  const finalDone =
    transaction.scheduleDates.length > 0 ? scheduleDone : doneCount;

  if (finalDone >= totalExpected) {
    await db.transaction.update({
      where: { id: transactionId },
      data: { status: "archived" },
    });
  }
}
