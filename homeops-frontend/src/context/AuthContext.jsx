import {createContext, useContext, useState, useEffect} from "react";
import useLocalStorage from "../hooks/useLocalStorage";
import AppApi from "../api/api";
import {jwtDecode as decode} from "jwt-decode";

export const TOKEN_STORAGE_ID = "app-token";
export const REFRESH_TOKEN_STORAGE_ID = "app-refresh-token";

/* Context for Authentication */
const AuthContext = createContext();

/* Custom hook to use the AuthContext */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/* Provider for the AuthContext */
export function AuthProvider({children}) {
  const [currentUser, setCurrentUser] = useState({
    data: null,
    isLoading: true,
  });
  const [token, setToken] = useLocalStorage(TOKEN_STORAGE_ID);
  const [isSigningUp, setIsSigningUp] = useState(false);

  /* Get the current user */
  useEffect(() => {
    async function getCurrentUser() {
      if (isSigningUp) {
        return;
      }

      if (token) {
        try {
          let {email} = decode(token);
          AppApi.token = token;

          let currentUser = await AppApi.getCurrentUser(email);

          if (!currentUser || !currentUser.id) {
            console.error("Current user or user ID is undefined");
            setCurrentUser({
              isLoading: false,
              data: null,
            });
            return;
          }

          let userAccounts = await getUserAccounts(currentUser.id);

          setCurrentUser({
            isLoading: false,
            data: {...currentUser, accounts: userAccounts || []},
          });
        } catch (err) {
          console.error("App loadUserInfo: problem loading", err);
          setCurrentUser({
            isLoading: false,
            data: null,
          });
        }
      } else {
        setCurrentUser({
          isLoading: false,
          data: null,
        });
      }
    }
    getCurrentUser();
  }, [token, isSigningUp]);

  /** Handles site-wide login. Throws with mfaRequired/mfaTicket when MFA is needed. */
  async function login(loginData) {
    const result = await AppApi.login(loginData);
    if (result.mfaRequired && result.mfaTicket) {
      const err = new Error("MFA required");
      err.mfaRequired = true;
      err.mfaTicket = result.mfaTicket;
      throw err;
    }

    const {accessToken, refreshToken} = result;
    setToken(accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_ID, refreshToken);

    const {email} = decode(accessToken);
    AppApi.token = accessToken;
    const currentUser = await AppApi.getCurrentUser(email);

    const userAccounts = await getUserAccounts(currentUser.id);

    setCurrentUser({
      isLoading: false,
      data: {...currentUser, accounts: userAccounts || []},
    });

    localStorage.removeItem("current-account");

    return accessToken;
  }

  /** Complete login after MFA verification. */
  async function completeMfaLogin(mfaTicket, codeOrBackupCode) {
    const {accessToken, refreshToken} = await AppApi.verifyMfa(mfaTicket, codeOrBackupCode);
    setToken(accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_ID, refreshToken);

    const {email} = decode(accessToken);
    AppApi.token = accessToken;
    const currentUser = await AppApi.getCurrentUser(email);

    const userAccounts = await getUserAccounts(currentUser.id);

    setCurrentUser({
      isLoading: false,
      data: {...currentUser, accounts: userAccounts || []},
    });

    localStorage.removeItem("current-account");

    return accessToken;
  }

  function extractTokenFromSignupResponse(signupResponse) {
    if (signupResponse?.accessToken) {
      return {
        accessToken: signupResponse.accessToken,
        refreshToken: signupResponse.refreshToken || null,
        user: signupResponse.user || null,
      };
    } else if (signupResponse?.token) {
      return {
        accessToken: signupResponse.token,
        refreshToken: null,
        user: signupResponse.user || null,
      };
    } else if (typeof signupResponse === "string") {
      return {accessToken: signupResponse, refreshToken: null, user: null};
    } else {
      throw new Error(
        `Invalid signup response format. Expected object with 'accessToken' property or a string, but received: ${typeof signupResponse}`,
      );
    }
  }

  async function fetchUser(signupUser, accessToken) {
    if (signupUser) {
      return signupUser;
    }

    const decodedToken = decode(accessToken);
    const {email} = decodedToken;
    const currentUser = await AppApi.getCurrentUser(email);

    if (!currentUser) {
      throw new Error("Failed to retrieve user after signup: user is null");
    }

    return currentUser;
  }

  function extractUserId(currentUser, decodedToken) {
    const tokenUserId =
      decodedToken.user_id || decodedToken.userId || decodedToken.id;
    const userId = currentUser.id || currentUser.userId || tokenUserId;

    if (!userId) {
      console.error("User object missing ID:", currentUser);
      console.error("Token payload:", decodedToken);
      throw new Error(
        `Failed to retrieve user ID after signup. User object: ${JSON.stringify(
          currentUser,
        )}, Token: ${JSON.stringify(decodedToken)}`,
      );
    }

    return userId;
  }

  async function getUserAccounts(userId) {
    try {
      return await AppApi.getUserAccounts(userId);
    } catch (error) {
      const errorMessage = Array.isArray(error)
        ? error.join(" ")
        : error.message || error.toString() || "";
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        return [];
      }
      throw error;
    }
  }

  async function createAccount({currentUser, userId}) {
    console.log("createAccount", currentUser);
    let newAccount = null;

    try {
      console.log("Creating account for new user:", {
        name: currentUser.name,
        userId: userId,
      });
      console.log("currentUser", currentUser);

      newAccount = await AppApi.createAccount({
        name: currentUser.name,
        ownerUserId: userId,
      });
    } catch (error) {
      const errorMessage = Array.isArray(error)
        ? error.join(" ")
        : error.message || error.toString() || "";

      const isConflictError =
        errorMessage.includes("already exists") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("409") ||
        errorMessage.includes("Conflict");

      if (isConflictError) {
        console.log("URL conflict, trying with sequential number");
        newAccount = await AppApi.createAccount({
          name: currentUser.name,
          ownerUserId: userId,
        });
      } else {
        throw error;
      }
    }

    if (!newAccount?.id) {
      throw new Error(
        `Account creation failed: account ID is missing. Account object: ${JSON.stringify(
          newAccount,
        )}`,
      );
    }

    console.log("Account created successfully:", newAccount);

    return [newAccount];
  }

  function initializeAuthentication(accessToken, refreshToken) {
    setToken(accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_ID, refreshToken);
    }
    AppApi.token = accessToken;
    return decode(accessToken);
  }

  async function ensureUserHasAccount(userId, currentUser, email) {
    let userAccounts = await getUserAccounts(userId);

    if (!userAccounts || userAccounts.length === 0) {
      try {
        userAccounts = await createDefaultAccount(userId, currentUser, email);
        console.log("User accounts after creation:", userAccounts);
      } catch (createError) {
        console.error(
          "Error creating account or user-account link:",
          createError,
        );
        const errorMessage = Array.isArray(createError)
          ? createError.join(" ")
          : createError.message || createError.toString() || "Unknown error";
        throw new Error(`Failed to create account: ${errorMessage}`);
      }
    }

    return userAccounts;
  }

  function finalizeUserSignup(currentUser, userId, userAccounts) {
    const userWithId = {
      ...currentUser,
      id: userId,
      accounts: userAccounts,
    };

    setCurrentUser({
      isLoading: false,
      data: userWithId,
    });

    localStorage.removeItem("current-account");

    return userWithId;
  }

  /** Handles site-wide signup */
  async function signup(signupData) {
    setIsSigningUp(true);
    try {
      const signupResponse = await AppApi.signup(signupData);
      const {accessToken, refreshToken, user: signupUser} =
        extractTokenFromSignupResponse(signupResponse);

      const decodedToken = initializeAuthentication(accessToken, refreshToken);
      const {email} = decodedToken;

      const currentUser = await fetchUser(signupUser, accessToken);

      const userId = extractUserId(currentUser, decodedToken);

      const userAccounts = await getUserAccounts(userId);

      const userWithId = finalizeUserSignup(currentUser, userId, userAccounts);

      setIsSigningUp(false);
      return {
        user: userWithId,
        token: accessToken,
      };
    } catch (error) {
      console.error("Signup error:", error);
      setIsSigningUp(false);
      throw error;
    }
  }

  /** Handle OAuth callback (Google, etc.): store tokens and load user. */
  async function handleOAuthCallback(accessToken, refreshToken = null) {
    if (!accessToken) throw new Error("No token received");
    const decodedToken = initializeAuthentication(accessToken, refreshToken);
    const {email} = decodedToken;
    const currentUser = await fetchUser(null, accessToken);
    const userId = extractUserId(currentUser, decodedToken);
    const userAccounts = await ensureUserHasAccount(userId, currentUser, email);
    const userWithAccounts = finalizeUserSignup(currentUser, userId, userAccounts);
    return userWithAccounts;
  }

  /** Refresh current user from API (e.g. after onboarding completion). */
  async function refreshCurrentUser() {
    if (!token) return null;
    try {
      const {email} = decode(token);
      AppApi.token = token;
      const currentUser = await AppApi.getCurrentUser(email);
      if (!currentUser?.id) return null;
      const userAccounts = await getUserAccounts(currentUser.id);
      const userWithAccounts = {...currentUser, accounts: userAccounts || []};
      setCurrentUser({isLoading: false, data: userWithAccounts});
      return userWithAccounts;
    } catch (err) {
      console.error("refreshCurrentUser failed:", err);
      return null;
    }
  }

  /** Handle user logout */
  function logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_ID);
    if (refreshToken) {
      AppApi.revokeRefreshToken(refreshToken);
    }

    localStorage.removeItem(TOKEN_STORAGE_ID);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_ID);
    AppApi.token = null;

    const keysToRemove = [
      "current-account",
      "contacts_list_page",
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    setCurrentUser({
      isLoading: false,
      data: null,
    });
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser.data,
        isLoading: currentUser.isLoading,
        login,
        completeMfaLogin,
        signup,
        logout,
        handleOAuthCallback,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
