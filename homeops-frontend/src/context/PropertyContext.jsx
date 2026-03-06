import React, {createContext, useState, useMemo, useEffect} from "react";
import AppApi from "../api/api";
import useLocalStorage from "../hooks/useLocalStorage";
import {useAuth} from "./AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {computeHpsScore} from "../pages/properties/helpers/computeHpsScore";
import {mapPropertyFromBackend} from "../pages/properties/helpers/preparePropertyValues";

const PropertyContext = createContext();

/* Context for Properties */
export function PropertyProvider({children}) {
  const [properties, setProperties] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewMode, setViewMode] = useLocalStorage(
    "properties-view-mode-v3",
    "grid",
  );
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();

  /** Normalize property for list display - ensure health value from hps_score/hpsScore.
   *  When the backend has no persisted score, compute it from the property's identity data. */
  function normalizePropertyForList(property) {
    if (!property || typeof property !== "object") return property;
    const stored = property.hps_score ?? property.hpsScore ?? property.health;
    const health =
      stored != null && Number.isFinite(Number(stored))
        ? Number(stored)
        : computeHpsScore(mapPropertyFromBackend(property));
    return {
      ...property,
      health,
    };
  }

  /* Get properties from backend */
  async function fetchProperties() {
    if (isLoading || !currentUser) {
      setProperties([]);
      return;
    }
    try {
      let fetchedProperties;
      if (currentUser.role === "super_admin") {
        fetchedProperties = await AppApi.getAllProperties();
      } else {
        if (currentAccount?.id) {
          fetchedProperties = await AppApi.getPropertiesByUserId(
            currentUser.id,
          );
        }
      }
      setProperties((fetchedProperties || []).map(normalizePropertyForList));
    } catch (err) {
      console.error("There was an error retrieving properties:", err);
      setProperties([]);
    }
  }

  // Clear properties immediately when the user changes to prevent stale data
  useEffect(() => {
    if (!currentUser) {
      setProperties([]);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchProperties();
  }, [isLoading, currentUser, currentAccount]);

  /* Get all properties by user ID */
  async function getPropertiesByUserId(userId) {
    try {
      const res = await AppApi.getPropertiesByUserId(userId);
      return res;
    } catch (err) {
      console.error("There was an error getting properties by user ID:", err);
      throw err;
    }
  }

  /* Get a property by ID */
  async function getPropertyById(uid) {
    try {
      const res = await AppApi.getPropertyById(uid);
      return res;
    } catch (err) {
      console.error("There was an error getting property by UID:", err);
      throw err;
    }
  }

  /* Add users to property */
  async function addUsersToProperty(propertyId, users) {
    try {
      const res = await AppApi.addUsersToProperty(propertyId, users);
      return res;
    } catch (err) {
      console.error("There was an error adding users to property:", err);
      throw err;
    }
  }

  /* Handle selection state */
  const handleToggleSelection = (ids, isSelected) => {
    if (Array.isArray(ids)) {
      if (typeof isSelected === "boolean") {
        setSelectedItems((prev) => {
          if (isSelected) {
            return [...new Set([...prev, ...ids])];
          } else {
            return prev.filter((id) => !ids.includes(id));
          }
        });
      } else {
        setSelectedItems(ids);
      }
    } else {
      setSelectedItems((prev) => {
        if (prev.includes(ids)) {
          return prev.filter((id) => id !== ids);
        } else {
          return [...prev, ids];
        }
      });
    }
  };

  /* Create a new property */
  const createProperty = async (propertyData) => {
    try {
      const res = await AppApi.createProperty(propertyData);
      setProperties((prevProperties) => [
        ...prevProperties,
        normalizePropertyForList(res),
      ]);
      return res;
    } catch (err) {
      console.error("There was an error creating property:", err);
      throw err;
    }
  };

  /* Update a property */
  async function updateProperty(propertyId, propertyData) {
    try {
      const res = await AppApi.updateProperty(propertyId, propertyData);
      setProperties((prevProperties) =>
        prevProperties.map((property) => {
          if (property.id !== propertyId) return property;
          // Merge response with existing + payload so hps_score is preserved
          // (backend PATCH may not return all fields)
          const merged = {
            ...property,
            ...res,
            hps_score:
              res.hps_score ?? propertyData.hps_score ?? property.hps_score,
          };
          return normalizePropertyForList(merged);
        }),
      );
      return res;
    } catch (err) {
      console.error("There was an error updating property:", err);
      throw err;
    }
  }

  /* Update a property team */
  async function updateTeam(propertyId, team) {
    try {
      const res = await AppApi.updatePropertyTeam(propertyId, team);
      return res;
    } catch (err) {
      console.error("There was an error updating property team:", err);
      throw err;
    }
  }
  /* --------- Systems --------- */

  /* Create systems for a property (used after createProperty) */
  async function createSystemsForProperty(propertyId, systemsPayloads) {
    if (!systemsPayloads?.length) return;
    await Promise.all(
      systemsPayloads.map((payload) => AppApi.createSystem(payload)),
    );
  }
  /* Update systems for a property */
  async function updateSystemsForProperty(propertyId, systems) {
    if (!systems?.length) return;
    try {
      const res = await Promise.all(
        systems.map((system) => AppApi.updateSystem(propertyId, system)),
      );
      return res;
    } catch (err) {
      console.error("There was an error updating systems for property:", err);
      throw err;
    }
  }

  /* Get all systems by property ID */
  async function getSystemsByPropertyId(propertyId) {
    try {
      const res = await AppApi.getSystemsByPropertyId(propertyId);
      return res;
    } catch (err) {
      console.error("There was an error getting systems by property ID:", err);
      throw err;
    }
  }

  /* Delete a property */
  const deleteProperty = async (propertyId) => {
    try {
      const res = await AppApi.deleteProperty(propertyId);
      setProperties((prevProperties) =>
        prevProperties.filter((property) => property.id !== propertyId),
      );
      return res;
    } catch (err) {
      console.error("There was an error deleting property:", err);
      throw err;
    }
  };

  /* Get property team */
  async function getPropertyTeam(propertyId) {
    try {
      const res = await AppApi.getPropertyTeam(propertyId);
      return res;
    } catch (err) {
      console.error("There was an error getting property team:", err);
      throw err;
    }
  }

  /* --------- Maintenance Records --------- */

  /* Create multiple maintenance records (batch) */
  async function createMaintenanceRecords(propertyId, records) {
    try {
      const res = await AppApi.createMaintenanceRecords(propertyId, records);
      return res;
    } catch (err) {
      console.error("There was an error creating maintenance records:", err);
      throw err;
    }
  }
  /* Create a new maintenance record */
  async function createMaintenanceRecord(data) {
    try {
      const res = await AppApi.createMaintenanceRecord(data);
      return res;
      console.log("Res from createMaintenanceRecord: ", res);
    } catch (err) {
      console.error("There was an error creating maintenance record:", err);
      throw err;
    }
  }

  /* Update a maintenance record */
  async function updateMaintenanceRecord(id, data) {
    try {
      const res = await AppApi.updateMaintenanceRecord(id, data);
      return res;
    } catch (err) {
      console.error("There was an error updating maintenance record:", err);
      throw err;
    }
  }

  /* Delete a maintenance record */
  async function deleteMaintenanceRecord(id) {
    try {
      await AppApi.deleteMaintenanceRecord(id);
    } catch (err) {
      console.error("There was an error deleting maintenance record:", err);
      throw err;
    }
  }

  /*  Get all maintenance records by property ID */
  async function getMaintenanceRecordsByPropertyId(propertyId) {
    console.log("Getting maintenance records by property ID: ", propertyId);
    try {
      const res = await AppApi.getMaintenanceRecordsByPropertyId(propertyId);
      console.log("Maintenance records by property ID: ", res);
      return res;
    } catch (err) {
      console.error(
        "There was an error getting maintenance records by property ID:",
        err,
      );
      throw err;
    }
  }

  useEffect(() => {}, [isLoading, currentUser, currentAccount]);

  const contextValue = useMemo(
    () => ({
      currentAccount,
      properties,
      selectedItems,
      setSelectedItems,
      viewMode,
      setViewMode,
      createProperty,
      createSystemsForProperty,
      updateProperty,
      deleteProperty,
      getPropertyById,
      addUsersToProperty,
      getPropertyTeam,
      updateTeam,
      getSystemsByPropertyId,
      updateSystemsForProperty,
      createMaintenanceRecord,
      updateMaintenanceRecord,
      deleteMaintenanceRecord,
      getMaintenanceRecordsByPropertyId,
      maintenanceRecords,
      setMaintenanceRecords,
      createMaintenanceRecords,
      refreshProperties: fetchProperties,
    }),
    [properties, currentAccount, maintenanceRecords, viewMode],
  );

  return (
    <PropertyContext.Provider value={contextValue}>
      {children}
    </PropertyContext.Provider>
  );
}

export default PropertyContext;
