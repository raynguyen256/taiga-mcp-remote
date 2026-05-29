export interface TaigaUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  bio?: string;
  photo?: string;
}

export interface TaigaProject {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_private: boolean;
  is_backlog_activated: boolean;
  is_issues_activated: boolean;
  is_kanban_activated: boolean;
  is_wiki_activated: boolean;
  total_milestones: number;
  total_story_points: number | null;
  tags: string[];
  members: number[];
}

export interface TaigaProjectStats {
  total_milestones: number;
  total_userstories: number;
  defined_points: number;
  assigned_points: number;
  closed_points: number;
  total_tasks: number;
  completed_tasks: number;
  total_issues: number;
  opened_issues: number;
  closed_issues: number;
}

export interface TaigaMilestone {
  id: number;
  name: string;
  project: number;
  estimated_start: string;
  estimated_finish: string;
  closed: boolean;
  total_points: number;
  closed_points: number;
  user_stories?: TaigaUserStory[];
}

export interface TaigaMilestoneStats {
  total_points: number;
  completed_points: number[];
  total_userstories: number;
  completed_userstories: number;
  incomplete_userstories: number;
  days: Array<{ day: string; optimal_points: number; open_points: number }>;
}

export interface TaigaUserStory {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  status: number;
  status_extra_info?: { name: string; color: string; is_closed: boolean };
  milestone: number | null;
  milestone_name?: string;
  project: number;
  assigned_to: number | null;
  assigned_to_extra_info?: { username: string; full_name_display: string };
  points: Record<string, unknown>;
  total_points: number | null;
  is_blocked: boolean;
  blocked_note?: string;
  tags: string[];
  epics?: Array<{ id: number; subject: string }>;
  version: number;
}

export interface TaigaTask {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  status: number;
  status_extra_info?: { name: string; color: string; is_closed: boolean };
  milestone: number | null;
  user_story: number | null;
  user_story_extra_info?: { ref: number; subject: string };
  project: number;
  assigned_to: number | null;
  assigned_to_extra_info?: { username: string; full_name_display: string };
  is_blocked: boolean;
  blocked_note?: string;
  tags: string[];
  version: number;
}

export interface TaigaIssue {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  status: number;
  status_extra_info?: { name: string; color: string; is_closed: boolean };
  type: number;
  type_extra_info?: { name: string; color: string };
  priority: number;
  priority_extra_info?: { name: string; color: string };
  severity: number;
  severity_extra_info?: { name: string; color: string };
  project: number;
  assigned_to: number | null;
  assigned_to_extra_info?: { username: string; full_name_display: string };
  tags: string[];
  version: number;
}

export interface TaigaEpic {
  id: number;
  ref: number;
  subject: string;
  description?: string;
  status: number;
  status_extra_info?: { name: string; color: string; is_closed: boolean };
  project: number;
  assigned_to: number | null;
  assigned_to_extra_info?: { username: string; full_name_display: string };
  user_stories_counts?: { total: number; progress: number };
  tags: string[];
  color: string;
  version: number;
}

export interface TaigaMembership {
  id: number;
  user: number;
  username: string;
  full_name: string;
  email: string;
  role: number;
  role_name: string;
  project: number;
  is_owner: boolean;
}

export interface TaigaAuthResponse {
  auth_token: string;
  refresh: string;
  username: string;
  full_name: string;
  email: string;
  id: number;
}

export interface TaigaRefreshResponse {
  auth_token: string;
}

export interface TaigaHistoryEntry {
  id: string;
  created_at: string;
  user: { username: string; full_name_display: string };
  comment: string;
  diff: Record<string, [unknown, unknown]>;
  type: number;
}

export interface TaigaTimelineEntry {
  id: number;
  created: string;
  event_type: string;
  data: Record<string, unknown>;
}

export interface TaigaUserStats {
  roles: string[];
  total_num_projects: number;
  total_num_contacts: number;
  total_num_closed_userstories: number;
}

export interface TaigaResolveResult {
  project: number;
  us?: number;
  task?: number;
  issue?: number;
  milestone?: number;
}

export interface TaigaStatus {
  id: number;
  name: string;
  color: string;
  is_closed: boolean;
  project: number;
  order: number;
}

export interface TaigaIssueType {
  id: number;
  name: string;
  color: string;
  project: number;
  order: number;
}

export interface TaigaPriority {
  id: number;
  name: string;
  color: string;
  project: number;
  order: number;
}

export interface TaigaSeverity {
  id: number;
  name: string;
  color: string;
  project: number;
  order: number;
}

export interface TaigaSearchResult {
  userstories: Array<{ id: number; ref: number; subject: string }>;
  tasks: Array<{ id: number; ref: number; subject: string }>;
  issues: Array<{ id: number; ref: number; subject: string }>;
  wikipages: Array<{ id: number; slug: string; name: string }>;
}
