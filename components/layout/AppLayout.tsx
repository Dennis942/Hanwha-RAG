"use client";

import type { ReactNode } from "react";
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
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <Sidebar
          activePage={props.activePage}
          navItems={props.navItems}
          onNavigate={props.onNavigate}
          onUploadClick={props.onUploadClick}
        >
          {props.sidebarContent}
        </Sidebar>
        <section className="px-5 py-6 lg:px-8">
          <Header currentPageLabel={props.currentPageLabel} />
          {props.children}
        </section>
      </div>
    </main>
  );
}

