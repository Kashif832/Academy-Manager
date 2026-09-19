-- CreateIndex
CREATE INDEX "FeeInvoice_academyId_month_idx" ON "FeeInvoice"("academyId", "month");

-- CreateIndex
CREATE INDEX "FeePayment_invoiceId_paidAt_idx" ON "FeePayment"("invoiceId", "paidAt");

-- CreateIndex
CREATE INDEX "Student_academyId_fullName_idx" ON "Student"("academyId", "fullName");
