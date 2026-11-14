import type { Shift } from "./format";

export type WorkerRow = {
  id: number;
  emp_no: string | null;
  full_name: string;
  alt_name: string | null;
  nationality: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  branch_id: number | null;
  job_title_id: number | null;
  job_title_ar: string | null;
  housing_id: number | null;
  housing_name: string | null;
  days_off: number[];
  no_day_off: boolean;
  shifts: Shift[];
  break_time: string | null;
  incomplete: boolean;
  off_today: boolean;
};

export type BranchSummary = {
  id: number;
  name_ar: string;
  name_en: string;
  status: string;
  city_id: number;
  city_ar: string;
  city_en: string;
  sort: number;
  city_sort: number;
  workers_total: number;
  on_leave: number;
  off_today: number;
  working_today: number;
  incomplete: number;
};
