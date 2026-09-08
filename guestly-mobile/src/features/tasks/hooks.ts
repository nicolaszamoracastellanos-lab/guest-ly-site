// Tasks data: the couple's own list (portal /tasks) and the shared board
// with the planner (portal /requests and /planner/requests).

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type TaskGroup = "overdue" | "today" | "week" | "later" | "undated" | "done";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high";
export type TaskRecurrence = "none" | "weekly" | "monthly";
export type TaskCategory = "legal" | "venue" | "vendors" | "guests" | "budget" | "travel" | "attire" | "ceremony" | "day_of" | "other";

export type Assignee = { kind: "user" | "collaborator"; id: string; name: string; email: string; language: "en" | "es"; hasPortalAccess: boolean };

export type TaskView = {
  id: string;
  title: string;
  notes: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_kind: "user" | "collaborator" | null;
  assignee_user_id: string | null;
  assignee_collaborator_id: string | null;
  due_date: string | null;
  remind_offsets_days: number[];
  recurrence: TaskRecurrence;
  template_key: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  group: TaskGroup;
  assignee: Assignee | null;
  days_left: number | null;
};

export type Collaborator = { id: string; name: string; role_label: string; email: string; phone: string | null; language: "en" | "es"; notifications_enabled: boolean };
export type Member = { userId: string; email: string; name: string; role: string };
export type TemplateView = { template_key: string; title: string; notes: string; category: TaskCategory; priority: TaskPriority; recurrence: TaskRecurrence; due_date: string; past: boolean; applied: boolean };

export type Board = {
  pending: boolean;
  today: string;
  tz: string;
  tasks: TaskView[];
  groups: Record<TaskGroup, TaskView[]>;
  group_order: TaskGroup[];
  progress: { done: number; total: number };
  collaborators: Collaborator[];
  members: Member[];
  settings: { reminders_enabled: boolean };
  feed_url: string | null;
  templates: TemplateView[];
  options: { categories: TaskCategory[]; statuses: TaskStatus[]; priorities: TaskPriority[]; recurrences: TaskRecurrence[]; default_offsets: number[] };
};

export type BoardStatus = "open" | "in_progress" | "done";
export type BoardComment = { id: string; author_role: "planner" | "couple"; author_email: string; body: string; created_at: string };
export type BoardTask = {
  id: string;
  title: string;
  detail: string;
  status: BoardStatus;
  assigned_to: "planner" | "couple";
  guest_ids: string[];
  guest_names: string[];
  comments: BoardComment[];
  created_by: string;
  created_by_role: "planner" | "couple";
  created_at: string;
  updated_at: string;
};

export const KEYS = {
  board: ["tasks-board"] as const,
  shared: ["tasks-shared"] as const,
  sharedOne: (id: string) => ["tasks-shared", id] as const,
};

export const useTasksBoard = () => useQuery({ queryKey: KEYS.board, queryFn: () => get<Board>("/couple/tasks") });

export const useSharedBoard = (surface: "couple" | "planner") =>
  useQuery({ queryKey: [...KEYS.shared, surface], queryFn: () => get<{ pending: boolean; tasks: BoardTask[] }>(surface === "couple" ? "/couple/tasks/board" : "/planner/tasks") });

export const useSharedTask = (surface: "couple" | "planner", id: string) =>
  useQuery({ queryKey: [...KEYS.sharedOne(id), surface], queryFn: () => get<{ task: BoardTask }>(surface === "couple" ? `/couple/tasks/board/${id}` : `/planner/tasks/${id}`), enabled: !!id });

/** All the keys a tasks mutation should refresh. */
export const TASK_INVALIDATE = ["tasks-board", "tasks-shared", "couple-home", "couple-more", "planner-home", "planner-requests", "planner-tasks"];

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
