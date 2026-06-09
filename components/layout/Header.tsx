"use client";

export function Header({ currentPageLabel }: { currentPageLabel: string }) {
  return (
    <header className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <p className="text-sm font-semibold text-[#f37321]">DA플랫폼팀 업무 지식관리</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{currentPageLabel}</h1>
      </div>
      <div className="rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
        사용자 프로필 · 관리자
      </div>
    </header>
  );
}

