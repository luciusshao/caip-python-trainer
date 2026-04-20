import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-brand-dark overflow-hidden">
      <TeacherSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
