import { PrismaClient, PlanTier, UserRole, StudentStatus, InvoiceStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…\n");

  // ── 1. Academy ────────────────────────────────────────────────────────────
  const academy = await prisma.academy.create({
    data: {
      name: "Bright Future Academy",
      slug: "bright-future",
      planTier: PlanTier.TRIAL,
      phone: "+92-300-1234567",
      address: "42 Education Street, Lahore, Pakistan",
      trialEndsAt: new Date("2026-09-27"), // 30 days from creation
    },
  });
  console.log(`✅ Academy: ${academy.name} (${academy.id})`);

  // ── 2. Owner user ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);
  const owner = await prisma.user.create({
    data: {
      academyId: academy.id,
      email: "owner@brightfuture.test",
      passwordHash,
      fullName: "Bilal Ahmed",
      role: UserRole.OWNER,
      phone: "+92-321-7654321",
    },
  });
  console.log(`✅ Owner:   ${owner.fullName} <${owner.email}>`);

  // ── 3. Classes ────────────────────────────────────────────────────────────
  const classData = [
    { name: "Grade 8", section: "Blue" },
    { name: "Grade 9", section: "Green" },
    { name: "Grade 7", section: "Blue" },
    { name: "Grade 10", section: "Red" },
  ];

  const classes = [];
  for (const c of classData) {
    const cls = await prisma.class.create({
      data: {
        academyId: academy.id,
        name: c.name,
        section: c.section,
        teacherId: owner.id, // owner acts as teacher for seed data
        monthlyFee: 15000,
      },
    });
    classes.push(cls);
    console.log(`✅ Class:   ${cls.name} · ${cls.section}`);
  }

  // ── 4. Students ───────────────────────────────────────────────────────────
  const currentMonth = "2026-08";
  const dueDate = new Date("2026-08-10");

  const studentData: {
    fullName: string
    parentName: string
    parentPhone: string
    classIndex: number
    status: StudentStatus
    monthlyFee: number
    invoiceStatus: InvoiceStatus
    admissionDate: Date
  }[] = [
    {
      fullName: "Ayesha Khan",
      parentName: "Faisal Khan",
      parentPhone: "+92-300-1111111",
      classIndex: 0,       // Grade 8 · Blue
      status: StudentStatus.ACTIVE,
      monthlyFee: 15000,
      invoiceStatus: InvoiceStatus.PAID,
      admissionDate: new Date("2026-01-15"),
    },
    {
      fullName: "Hamza Raza",
      parentName: "Imran Raza",
      parentPhone: "+92-300-2222222",
      classIndex: 1,       // Grade 9 · Green
      status: StudentStatus.ACTIVE,
      monthlyFee: 15000,
      invoiceStatus: InvoiceStatus.PENDING,
      admissionDate: new Date("2026-03-01"),
    },
    {
      fullName: "Maham Ali",
      parentName: "Saad Ali",
      parentPhone: "+92-300-3333333",
      classIndex: 2,       // Grade 7 · Blue
      status: StudentStatus.ACTIVE,
      monthlyFee: 14000,
      invoiceStatus: InvoiceStatus.PAID,
      admissionDate: new Date("2026-02-10"),
    },
    {
      fullName: "Usman Tariq",
      parentName: "Tariq Mehmood",
      parentPhone: "+92-300-4444444",
      classIndex: 3,       // Grade 10 · Red
      status: StudentStatus.ACTIVE,
      monthlyFee: 16000,
      invoiceStatus: InvoiceStatus.OVERDUE,
      admissionDate: new Date("2025-09-01"),
    },
  ];

  for (const s of studentData) {
    const cls = classes[s.classIndex];

    const student = await prisma.student.create({
      data: {
        academyId: academy.id,
        classId: cls.id,
        fullName: s.fullName,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        admissionDate: s.admissionDate,
        status: s.status,
        monthlyFee: s.monthlyFee,
      },
    });

    // Create the corresponding FeeInvoice for the current month
    const amountPaid =
      s.invoiceStatus === InvoiceStatus.PAID
        ? s.monthlyFee          // fully paid
        : s.invoiceStatus === InvoiceStatus.PARTIAL
          ? s.monthlyFee / 2    // half paid
          : 0;                  // pending or overdue → nothing paid

    const invoice = await prisma.feeInvoice.create({
      data: {
        academyId: academy.id,
        studentId: student.id,
        month: currentMonth,
        amountDue: s.monthlyFee,
        amountPaid,
        status: s.invoiceStatus,
        dueDate,
      },
    });

    // If paid, also create a FeePayment record
    if (s.invoiceStatus === InvoiceStatus.PAID) {
      await prisma.feePayment.create({
        data: {
          academyId: academy.id,
          invoiceId: invoice.id,
          amount: s.monthlyFee,
          paymentMethod: "CASH",
          receiptNumber: `RCP-${student.id.slice(0, 8).toUpperCase()}`,
          recordedByUserId: owner.id,
        },
      });
    }

    const target = `${cls.name} · ${cls.section}`;
    console.log(
      `✅ Student: ${student.fullName} → ${target} | Invoice: ${s.invoiceStatus}`,
    );
  }

  console.log("\n🎉 Seed complete!\n");
  console.log("   Demo credentials:");
  console.log("   📧 owner@brightfuture.test");
  console.log("   🔑 password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
