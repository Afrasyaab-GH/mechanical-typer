/** Interface dictionary. English only. */
const I18N: Record<string, string> = {
  subtitle: "A mechanical document editor.",
  tagline1: "Before words became data, they were impact.",
  hint: "“Press any key.”",
  footer: "Your writing never leaves this device.",
  "sec.machine": "MACHINE",
  "sec.view": "VIEW",
  "sec.document": "DOCUMENT",
  "sec.modern": "MODERN AIDS",
  "panel.hide": "HIDE PANEL",
  "panel.show": "PANEL",
  "btn.explode": "EXPLODE",
  "btn.assemble": "ASSEMBLE",
  "btn.cutaway": "CUTAWAY",
  "btn.write": "WRITE",
  "btn.paper": "PAPER",
  "btn.mechanism": "MECHANISM",
  "btn.inspect": "INSPECT",
  "btn.sound": "SOUND",
  "btn.customize": "FINISH / STUDIO",
  "btn.newSheet": "NEW SHEET",
  "btn.undo": "UNDO",
  "btn.redo": "REDO",
  "btn.export": "EXPORT DOCX",
  "btn.clear": "CLEAR",
  "btn.unicode": "UNICODE ADAPTER",
  "btn.autoreturn": "AUTO-RETURN",
  "btn.autoNextPage": "AUTO-SHEET FEED",
  "btn.font": "FONT",
  "btn.textSize": "TEXT SIZE",
  "btn.sample": "SAMPLE",
  "plaque.assemble": "ASSEMBLE THE MACHINE TO WRITE.",
  "plaque.margin": "RETURN CARRIAGE ↵",
  "plaque.pageFull": "PAGE FULL — NEW SHEET (⌘/CTRL + ENTER)",
  "plaque.clash": "TYPEBAR CLASH — TIMING STAGGERED",
  "plaque.pageFullDone": "PAGE FULL — INSERT NEW SHEET",
  "plaque.draftSaved": "DRAFT SAVED ON THIS DEVICE",
  "plaque.draftFailed": "DRAFT SAVE FAILED — STORAGE UNAVAILABLE",
  "plaque.draftRestored": "LOCAL DRAFT RESTORED",
  "plaque.cleared": "MANUSCRIPT CLEARED",
  "plaque.sample": "SAMPLE MANUSCRIPT LOADED",
  "plaque.unicode":
    "UNICODE ADAPTER IS A CONTEMPORARY DIGITAL EXTENSION, NOT AN ORIGINAL MECHANICAL CAPABILITY.",
  "plaque.autoreturn": "MODERN AUTO-RETURN ENGAGED — THE ORIGINAL MACHINE NEVER WRAPS.",
  "plaque.autoNextPage": "AUTO-SHEET FEED ENGAGED — AUTOMATIC PAGE INSERTION AT END OF SHEET.",
  "stats.words": "words",
  "stats.word": "word",
  "stats.pages": "pages",
  "stats.page": "page",
  "stats.characters": "characters",
  "stats.character": "character",
  "part.follow": "FOLLOW THE KEYSTROKE",
  "part.from": "FROM",
  "part.drives": "DRIVES",
  "part.info": "Part information",
  "confirm.draft": "A LOCAL DRAFT EXISTS ON THIS DEVICE.",
  "confirm.resume": "RESUME",
  "confirm.discard": "DISCARD",
  "confirm.clear": "CLEAR THE ENTIRE MANUSCRIPT? THIS CANNOT BE UNDONE.",
  "confirm.confirm": "CONFIRM",
  "confirm.cancel": "CANCEL",
  "export.title": "EXPORT · DOCX",
  "export.docTitle": "DOCUMENT TITLE",
  "export.author": "AUTHOR (LEFT EMPTY FOR PRIVACY)",
  "export.overstrike": "OVERSTRIKES",
  "export.keepFinal": "Keep final character",
  "export.annotated": "Preserve as annotated text",
  "export.fontChecking": "CHECKING FONT…",
  "export.fontOk": "FONT: COURIER PRIME (SIL OFL) — WILL BE EMBEDDED",
  "export.fontMissing": "FONT FILE UNAVAILABLE — COURIER PRIME NAMED, SYSTEM FALLBACK",
  "export.go": "EXPORT",
  "export.generating": "GENERATING…",
  "export.failed": "EXPORT FAILED — YOUR MANUSCRIPT IS INTACT.",
  "export.embedded": "font embedded",
  "export.referenced": "font referenced",
  "export.privacy": "Your writing never leaves this device.",
  "export.untitled": "Untitled manuscript",
  "export.settings": "Export settings",
};

export function t(key: string): string {
  return I18N[key] ?? key;
}

export function partName(label: string): string {
  return label;
}

export function partFn(fn: string): string {
  return fn;
}

export function systemName(system: string): string {
  return system.toUpperCase();
}
