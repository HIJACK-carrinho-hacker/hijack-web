import { RouterProvider, createBrowserRouter } from "react-router";
import { HijackProvider } from "@/app/hijack-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RequireRole } from "@/components/hijack/require-role";
import { AdminPage } from "@/pages/admin";
import { HackerPage } from "@/pages/hacker";
import { LoginPage } from "@/pages/login";
import { PilotPage } from "@/pages/pilot";
import { SimulatorPage } from "@/pages/simulator";

const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  {
    path: "/pilot",
    element: (
      <RequireRole role="pilot">
        <PilotPage />
      </RequireRole>
    ),
  },
  {
    path: "/hacker",
    element: (
      <RequireRole role="hacker">
        <HackerPage />
      </RequireRole>
    ),
  },
  { path: "/admin", element: <AdminPage /> },
  { path: "/simulator", element: <SimulatorPage /> },
]);

export default function App() {
  return (
    <HijackProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster theme="dark" position="top-center" />
      </TooltipProvider>
    </HijackProvider>
  );
}
