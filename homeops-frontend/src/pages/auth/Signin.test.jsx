import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Signin from "./Signin";
import { ApiError } from "../../api/api";

const mockLogin = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    completeMfaLogin: vi.fn(),
    currentUser: { data: null, isLoading: false },
  }),
}));

// Mock react-i18next so i18n init works and we control useTranslation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty" },
}));

describe("Signin error display", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("displays 'Invalid email or password' for 401 credential errors", async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(["Invalid username/password"], 401));

    const { container } = render(
      <MemoryRouter>
        <Signin />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    const buttons = screen.getAllByRole("button", { name: /continue/i });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(container.textContent).toMatch(/Invalid email or password/i);
    });
  });

  it("displays 'Unable to sign in right now' for network errors", async () => {
    const networkError = new TypeError("Failed to fetch");
    mockLogin.mockRejectedValueOnce(networkError);

    render(
      <MemoryRouter>
        <Signin />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    const buttons = screen.getAllByRole("button", { name: /continue/i });
    fireEvent.click(buttons[0]);

    // findByText waits for the element to appear (async)
    await expect(screen.findByText(/Unable to sign in right now/i)).resolves.toBeTruthy();
  });
});
