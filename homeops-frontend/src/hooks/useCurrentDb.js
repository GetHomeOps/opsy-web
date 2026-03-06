import { useState, useEffect } from "react";
import useLocalStorage from "./useLocalStorage";
import { useAuth } from "../context/AuthContext";
import AppApi from "../api/api";

/**
 * Hook to manage current database selection
 * Handles initialization and updates when user changes
 */
export default function useCurrentDb() {
  const { currentUser } = useAuth();
  const [currentDb, setCurrentDb] = useLocalStorage("current-db", null);

  // Initialize currentDb with first database when user is available
  useEffect(() => {
    // Clear database selection if user is logged out
    if (!currentUser) {
      if (currentDb) {
        setCurrentDb(null);
      }
      return;
    }

    // Set database when user has databases
    if (currentUser.databases && currentUser.databases.length > 0) {
      // Check if stored database belongs to current user
      const storedDbBelongsToUser =
        currentDb?.id &&
        currentUser.databases.some((db) => db.id === currentDb.id);

      // Update if no database is set, or if stored database doesn't belong to current user
      if (!storedDbBelongsToUser) {
        const firstDb = currentUser.databases[0];
        setCurrentDb({
          id: firstDb.id,
          name: firstDb.name,
          url: firstDb.url?.replace(/^\/+/, "") || firstDb.name,
        });
      }
    } else if (currentDb) {
      // Clear database selection if user has no databases
      setCurrentDb(null);
    }
  }, [currentUser, currentDb, setCurrentDb]);

  const setSelectedDb = (dbIdentifier) => {
    if (!currentUser || !currentUser.databases) return;

    let db;
    // Check if it's a database object or an ID
    if (typeof dbIdentifier === "object" && dbIdentifier.id) {
      db = dbIdentifier;
    } else {
      // Find database by ID
      db = currentUser.databases.find(
        (d) => d.id === dbIdentifier || d.id === Number(dbIdentifier)
      );
    }

    if (db) {
      setCurrentDb({
        id: db.id,
        name: db.name,
        url: db.url?.replace(/^\/+/, "") || db.name,
      });
    }
  };

  return { currentDb, setSelectedDb };
}

