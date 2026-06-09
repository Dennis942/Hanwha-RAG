"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar, type SidebarNavItem } from "@/components/layout/Sidebar";

export function AppLayout(props: {
  activePage: string;
  children: ReactNode;
  currentPageLabel: string;
  navItems: SidebarNavItem[];
  onNavigate: (page: string) => void;
  onUploadClick: () => void;
  sidebarContent?: ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    setIsSidebarCollapsed(window.localStorage.getItem("hanwha-rag-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("hanwha-rag-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <main className="min-h-screen">
      <div className={`grid min-h-screen ${isSidebarCollapsed ? "lg:grid-cols-[84px_1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
        <Sidebar
          activePage={props.activePage}
          collapsed={isSidebarCollapsed}
          navItems={props.navItems}
          onNavigate={props.onNavigate}
          onToggleCollapsed={toggleSidebar}
          onUploadClick={props.onUploadClick}
        >
          {!isSidebarCollapsed && props.sidebarContent}
        </Sidebar>
        <section className="px-5 py-6 lg:px-8">
          <Header currentPageLabel={props.currentPageLabel} />
          {props.children}
        </section>
      </div>
    </main>
  );
}
