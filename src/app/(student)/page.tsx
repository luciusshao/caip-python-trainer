"use client";

import Sidebar from "@/components/Sidebar";
import LessonView from "@/components/LessonView";
import Header from "@/components/Header";

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Learning Map */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <LessonView />
      </main>
    </div>
  );
}
