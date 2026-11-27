function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Ctrl/Cmd+K (no Alt/Shift). */
export function isOpenShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
}

/** "/" outside editable fields. */
export function isSlashShortcut(e: KeyboardEvent): boolean {
  return e.key === '/' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target);
}
