import {useState, useEffect} from "react";

/** Custom hook for keeping state data synced with localStorage.
 *
 * This creates `item` as state and look in localStorage for current value
 * (if not found, defaults to `firstValue`)
 *
 * When `item` changes, effect re-runs:
 * - if new state is null, removes from localStorage
 * - else, updates localStorage
 *
 * To the component, this just acts like state that is also synced to/from
 * localStorage::
 *
 *   const [myThing, setMyThing] = useLocalStorage("myThing")
 */
function useLocalStorage(key, firstValue = null) {
  const initialValue = (() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        // Try to parse it as JSON first
        try {
          return JSON.parse(item);
        } catch {
          // If it's not JSON, return as is
          return item;
        }
      }
      return firstValue;
    } catch {
      return firstValue;
    }
  })();

  const [item, setItem] = useState(initialValue);

  useEffect(
    function setKeyInLocalStorage() {
      if (item === null) {
        localStorage.removeItem(key);
      } else {
        // If it's an array or object, stringify it
        const valueToStore =
          typeof item === "object" ? JSON.stringify(item) : item;
        localStorage.setItem(key, valueToStore);
      }
    },
    [key, item]
  );

  return [item, setItem];
}

export default useLocalStorage;
