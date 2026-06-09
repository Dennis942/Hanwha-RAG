"use client";

import type { ChatMessage as ChatMessageType } from "@/lib/types";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 ${isUser ? "bg-ocean text-white" : "border border-line bg-white text-slate-700"}`}>
        <p>{message.content}</p>
        {message.createdAt && <p className={`mt-2 text-xs ${isUser ? "text-blue-50" : "text-slate-400"}`}>{message.createdAt}</p>}
      </div>
    </div>
  );
}

