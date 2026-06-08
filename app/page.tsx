"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CircleArrowRight,
  FileSearch,
  FileText,
  Filter,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  PanelLeftClose,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge, FieldLabel, Panel, SectionHeader } from "@/components/ui";
import { currentUser, documents, projects, recentQuestions, tags } from "@/lib/mock-data";
import { askKnowledgeBase, searchWorkHistory } from "@/lib/rag-service";
import { isSupabaseConfigured, supabase, supabaseDiagnostics, type SupabaseDocument } from "@/lib/supabase";
import type { ChangeEvent } from "react";
import type { LucideIcon } from "lucide-react";

const statusTone = {
  uploaded: "blue",
  Uploaded: "blue",
  Pending: "amber",
  Processing: "amber",
  Indexed: "green",
  Failed: "red",
  Reprocessing: "blue",
  Deleted: "neutral"
} as const;

const allowedDocumentExtensions = ["pdf", "txt", "docx"] as const;
const documentsBucketName = "documents";

type UploadDebugInfo = {
  selectedFile?: string;
  storageUploadStarted: boolean;
  bucketName: string;
  filePath?: string;
  storagePath?: string;
  uploadErrorJson?: string;
  networkError?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  insertStarted: boolean;
  insertErrorJson?: string;
};

function getStatusTone(status: string) {
  return statusTone[status as keyof typeof statusTone] ?? "neutral";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function makeStoragePath(file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

  return `uploads/${id}-${safeName}`;
}
