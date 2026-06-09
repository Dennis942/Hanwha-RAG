"use client";

import type { ComponentType, ReactNode } from "react";
import { PanelLeftClose, PanelRightOpen, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui";
import { currentUser } from "@/lib/mock-data";

export type SidebarNavItem = {
  id: string;
  label: string;
  icon: ComponentType<any>;
};

export function Sidebar(props: {
  activePage: string;
  children?: ReactNode;
  collapsed?: boolean;
  navItems: SidebarNavItem[];
  onNavigate: (page: string) => void;
  onToggleCollapsed: () => void;
  onUploadClick: () => void;
}) {
  return (
    <aside className={`border-r border-line bg-white px-4 py-5 ${props.collapsed ? "overflow-hidden" : ""}`}>
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <HanwhaMark />
          {!props.collapsed && (
            <div>
              <p className="text-xl font-bold tracking-normal text-ink">Eagle Next</p>
              <p className="text-xs text-slate-500">Hanwha Work AI</p>
            </div>
          )}
        </div>
        <button type="button" onClick={props.onToggleCollapsed} className="rounded-md p-1 text-slate-500 hover:bg-field" aria-label={props.collapsed ? "사이드바 펼치기" : "사이드바 접기"}>
          {props.collapsed ? <PanelRightOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
        </button>
      </div>
      <button
        type="button"
        onClick={props.onUploadClick}
        className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#f37321] bg-white text-sm font-bold text-[#f37321] transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-[#f37321]/40"
      >
        <PlusCircle size={18} aria-hidden />
        {!props.collapsed && "문서 업로드"}
      </button>
      <nav className="space-y-1" aria-label="주요 메뉴">
        {props.navItems.map((item) => {
          const Icon = item.icon;
          const isActive = props.activePage === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onNavigate(item.id)}
              title={props.collapsed ? item.label : undefined}
              className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ocean/30 ${
                isActive ? "bg-[#111111] text-white" : "text-slate-700 hover:bg-field"
              }`}
            >
              <Icon size={18} aria-hidden />
              {!props.collapsed && item.label}
            </button>
          );
        })}
      </nav>
      {props.children}
      {!props.collapsed && (
        <>
          <div className="mt-8 rounded-md border border-line bg-field p-3">
            <p className="text-sm font-semibold text-ink">{currentUser.name}</p>
            <p className="mt-1 text-xs text-slate-500">{currentUser.email}</p>
            <Badge tone="amber">Admin</Badge>
          </div>
          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Powered by Hanwha AI</p>
        </>
      )}
    </aside>
  );
}

function HanwhaMark() {
  return (
    <div className="relative h-11 w-11" aria-label="Hanwha inspired orange mark">
      <span className="absolute left-1 top-3 h-6 w-9 rotate-[-20deg] rounded-[50%] border-[5px] border-[#f37321]" />
      <span className="absolute left-3 top-4 h-6 w-8 rotate-[24deg] rounded-[50%] border-[4px] border-[#f89b61]" />
      <span className="absolute left-4 top-2 h-7 w-8 rotate-[14deg] rounded-[50%] border-[4px] border-[#ffb37a]" />
    </div>
  );
}
