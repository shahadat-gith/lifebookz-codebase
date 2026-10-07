/** Shared shapes for the payloads the Lifebookz API returns. */

/**
 * Media fields (avatar, banner, cover) come back as `{ url, key }` objects —
 * or as plain strings from a few older endpoints. `avatarUrl()` normalizes.
 */
export type MediaRef = { url?: string; key?: string } | string | null | undefined;

export interface User {
  id?: string;
  _id?: string;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  avatar?: MediaRef;
  coverImage?: MediaRef;
  bio?: string;
  profession?: string;
  gender?: string;
  city?: string;
  country?: string;
  address?: { city?: string; state?: string; country?: string };
  phone?: string;
  dob?: string;
  verification?: { status?: string };
  stats?: Record<string, number>;
}

/** One story entry inside a lifebook chapter. */
export interface StoryEntry {
  _id?: string;
  id?: string;
  title?: string;
  content?: string;
  storyType?: string;
  dateLabel?: string;
  location?: string;
  media?: MediaRef[];
  createdAt?: string;
}

export interface Chapter {
  _id?: string;
  id?: string;
  title?: string;
  content?: string;
  storyType?: string;
  dateLabel?: string;
  location?: string;
  order?: number;
  chapterNumber?: number;
  /**
   * A chapter's story entries. The detail endpoint puts each entry's HTML
   * content here; list payloads abbreviate to titles only.
   */
  stories?: StoryEntry[];
  createdAt?: string;
}

export interface Author {
  _id?: string;
  id?: string;
  fullName?: string;
  username?: string;
  avatar?: MediaRef;
  bio?: string;
  profession?: string;
  verification?: { status?: string };
  stats?: Record<string, number>;
}

export interface Story {
  _id?: string;
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  bannerImage?: MediaRef;
  coverImage?: MediaRef;
  language?: string;
  authorProfession?: string;
  featured?: boolean;
  publishedAt?: string;
  createdAt?: string;
  author?: Author;
  chapters?: Chapter[];
  likedByUser?: boolean;
  recentLikers?: { user?: string; fullName?: string }[];
  stats?: { likes?: number; comments?: number; shares?: number; views?: number; bookmarks?: number };
}

export interface Comment {
  _id?: string;
  id?: string;
  content?: string;
  createdAt?: string;
  likedByUser?: boolean;
  /** The web client reads these two; they are the API's computed fields. */
  likedByMe?: boolean;
  likeCount?: number;
  user?: Author;
  author?: Author;
  /** Raw likes subdocument on some endpoints: { who: string[], ... }. */
  likes?:
    | number
    | { who?: (string | User)[]; whoModel?: string; createdAt?: string };
  replies?: Comment[];
}

export interface Expert {
  _id?: string;
  id?: string;
  fullName?: string;
  avatar?: MediaRef;
  bio?: string;
  headline?: string;
  profession?: string;
  categories?: string[];
  experience?: number;
  rating?: number;
  sessionsCompleted?: number;
  hourlyRate?: number;
  languages?: string[];
  verification?: { status?: string };
}

export type ConsultationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export interface Consultation {
  _id?: string;
  id?: string;
  status?: ConsultationStatus;
  problem?: string;
  category?: string;
  notes?: string;
  scheduledAt?: string;
  createdAt?: string;
  expert?: Expert;
  user?: User;
  amount?: number;
  rating?: { score?: number; review?: string };
}

/** A community testimonial shown on the home screen (readers, authors, experts). */
export interface Testimonial {
  _id?: string;
  id?: string;
  message?: string;
  rating?: number;
  status?: string;
  personType?: "User" | "Author" | "Expert" | string;
  person?: {
    _id?: string;
    fullName?: string;
    profession?: string;
    avatar?: MediaRef;
  };
  createdAt?: string;
}

export interface Pagination {
  page: number;
  pages: number;
  total?: number;
  limit?: number;
}
