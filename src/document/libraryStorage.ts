import { Manuscript, type ManuscriptJSON, SAMPLE_MANUSCRIPT } from "./Manuscript";

export const LIBRARY_STORAGE_KEY = "platen_projects_library_v1";

export interface ProjectManuscript {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  text: string;
  manuscriptData?: ManuscriptJSON;
  stats: {
    words: number;
    chars: number;
    pages: number;
    keystrokes?: number;
    entropyScore?: number;
  };
  tags: string[];
}

const DEFAULT_PROJECTS: ProjectManuscript[] = [
  {
    id: "proj_sample_manifesto",
    title: "The Mechanical Manifesto",
    author: "Platen Scribe",
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 1,
    text: SAMPLE_MANUSCRIPT,
    stats: {
      words: 78,
      chars: 486,
      pages: 4,
      keystrokes: 520,
      entropyScore: 0.94,
    },
    tags: ["Philosophy", "Typewriter"],
  },
  {
    id: "proj_vintage_notes",
    title: "Notes on Ink, Steel & Intention",
    author: "Platen Scribe",
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 2,
    text: `CHAPTER I: THE WEIGHT OF THE KEY\n\nWhen a letter is struck against platen rubber, there is no backspace to erase history. The hammer leaves an indentation, permanent and sovereign.\n\nEvery mistake is an overstrike; every pause is a cadence in time.`,
    stats: {
      words: 42,
      chars: 260,
      pages: 1,
      keystrokes: 280,
      entropyScore: 0.91,
    },
    tags: ["Essay", "Draft"],
  },
];

/** Loads all projects stored in local storage */
export function getLibrary(): ProjectManuscript[] {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) {
      // Seed default projects
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECTS));
      return DEFAULT_PROJECTS;
    }
    const parsed = JSON.parse(raw) as ProjectManuscript[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PROJECTS;
    }
    return parsed;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

/** Saves the full library list to local storage */
export function saveLibrary(projects: ProjectManuscript[]): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save Platen projects library", err);
  }
}

/** Retrieve a single project by ID */
export function getProject(id: string): ProjectManuscript | null {
  const list = getLibrary();
  return list.find((p) => p.id === id) ?? null;
}

/** Create a new blank or pre-filled project */
export function createProject(
  title = "Untitled Manuscript",
  author = "",
  initialText = "",
  tags = ["Draft"],
): ProjectManuscript {
  const list = getLibrary();
  const newProject: ProjectManuscript = {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || "Untitled Manuscript",
    author: author.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    text: initialText,
    stats: {
      words: initialText.trim() ? initialText.trim().split(/\s+/).length : 0,
      chars: initialText.length,
      pages: Math.max(1, Math.ceil(initialText.split("\n").length / 32)),
      keystrokes: initialText.length,
      entropyScore: 0.88,
    },
    tags,
  };

  const updated = [newProject, ...list];
  saveLibrary(updated);
  return newProject;
}

/** Update or save an existing project */
export function saveProject(project: Partial<ProjectManuscript> & { id: string }): ProjectManuscript | null {
  const list = getLibrary();
  const index = list.findIndex((p) => p.id === project.id);
  if (index === -1) return null;

  const existing = list[index];
  const words = project.text !== undefined ? (project.text.trim() ? project.text.trim().split(/\s+/).length : 0) : existing.stats.words;
  const chars = project.text !== undefined ? project.text.length : existing.stats.chars;
  const pages = project.text !== undefined ? Math.max(1, Math.ceil(project.text.split("\n").length / 32)) : existing.stats.pages;

  const updatedItem: ProjectManuscript = {
    ...existing,
    ...project,
    updatedAt: Date.now(),
    stats: {
      ...existing.stats,
      ...(project.stats ?? {}),
      words,
      chars,
      pages,
    },
  };

  list[index] = updatedItem;
  saveLibrary(list);
  return updatedItem;
}

/** Delete a project from the library */
export function deleteProject(id: string): boolean {
  const list = getLibrary();
  const filtered = list.filter((p) => p.id !== id);
  if (filtered.length === list.length) return false;
  saveLibrary(filtered);
  return true;
}

/** Duplicate a project */
export function duplicateProject(id: string): ProjectManuscript | null {
  const target = getProject(id);
  if (!target) return null;

  const copy: ProjectManuscript = {
    ...target,
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: `${target.title} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [...target.tags, "Copy"],
  };

  const list = getLibrary();
  saveLibrary([copy, ...list]);
  return copy;
}

/** Sync the current active typewriter manuscript into a library project */
export function syncActiveManuscriptToLibrary(
  manuscript: Manuscript,
  title = "Active Manuscript",
  author = "",
  existingId?: string,
): ProjectManuscript {
  const list = getLibrary();
  const text = manuscript.getText();
  const data = manuscript.toJSON();
  const words = manuscript.wordCount;
  const chars = manuscript.charCount;
  const pages = manuscript.pages.length;

  if (existingId) {
    const existing = list.find((p) => p.id === existingId);
    if (existing) {
      const updatedItem: ProjectManuscript = {
        ...existing,
        title: title || existing.title,
        author: author || existing.author,
        text,
        manuscriptData: data,
        updatedAt: Date.now(),
        stats: {
          ...existing.stats,
          words,
          chars,
          pages,
        },
      };
      const idx = list.findIndex((p) => p.id === existingId);
      list[idx] = updatedItem;
      saveLibrary(list);
      return updatedItem;
    }
  }

  // Find if an "Active Draft" project already exists or create one
  const activeDraftIndex = list.findIndex((p) => p.tags.includes("Active Typewriter"));
  if (activeDraftIndex >= 0) {
    const existing = list[activeDraftIndex];
    const updatedItem: ProjectManuscript = {
      ...existing,
      title: title || existing.title,
      text,
      manuscriptData: data,
      updatedAt: Date.now(),
      stats: {
        ...existing.stats,
        words,
        chars,
        pages,
      },
    };
    list[activeDraftIndex] = updatedItem;
    saveLibrary(list);
    return updatedItem;
  }

  // Otherwise create new active project
  const newProj: ProjectManuscript = {
    id: `proj_${Date.now()}_active`,
    title: title || "Active Typewriter Manuscript",
    author: author || "Platen Scribe",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    text,
    manuscriptData: data,
    stats: {
      words,
      chars,
      pages,
      keystrokes: chars,
      entropyScore: 0.95,
    },
    tags: ["Active Typewriter", "Draft"],
  };

  saveLibrary([newProj, ...list]);
  return newProj;
}
