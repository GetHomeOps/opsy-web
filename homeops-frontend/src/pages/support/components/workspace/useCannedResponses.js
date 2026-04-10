import { useState, useEffect, useCallback, useRef } from "react";
import {
  readCannedResponses,
  writeCannedResponses,
  isShortcutTaken,
  validateShortcutKey,
} from "./cannedResponsesStorage";

/**
 * @returns {{
 *   items: import('./cannedResponsesStorage').CannedResponse[],
 *   add: (draft: { title: string, shortcutKey: string, body: string }) => { ok: true } | { ok: false, error: string },
 *   update: (id: string, draft: { title: string, shortcutKey: string, body: string }) => { ok: true } | { ok: false, error: string },
 *   remove: (id: string) => void,
 * }}
 */
export function useCannedResponses() {
  const [items, setItems] = useState(() => readCannedResponses());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    writeCannedResponses(items);
  }, [items]);

  const add = useCallback((draft) => {
    const title = draft.title?.trim();
    const body = draft.body?.trim();
    if (!title) return { ok: false, error: "Title is required." };
    if (!body) return { ok: false, error: "Message text is required." };
    const v = validateShortcutKey(draft.shortcutKey);
    if (!v.ok) return { ok: false, error: v.message };
    if (isShortcutTaken(v.key, itemsRef.current)) {
      return { ok: false, error: "That shortcut is already in use." };
    }
    setItems((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        title,
        shortcutKey: v.key,
        body,
        builtin: false,
      },
    ]);
    return { ok: true };
  }, []);

  const update = useCallback((id, draft) => {
    const title = draft.title?.trim();
    const body = draft.body?.trim();
    if (!title) return { ok: false, error: "Title is required." };
    if (!body) return { ok: false, error: "Message text is required." };
    const v = validateShortcutKey(draft.shortcutKey);
    if (!v.ok) return { ok: false, error: v.message };
    if (isShortcutTaken(v.key, itemsRef.current, id)) {
      return { ok: false, error: "That shortcut is already in use." };
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, title, shortcutKey: v.key, body }
          : item,
      ),
    );
    return { ok: true };
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, add, update, remove };
}
