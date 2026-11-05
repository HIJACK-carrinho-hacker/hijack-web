import { RouterProvider, createBrowserRouter } from "react-router";
import { HijackProvider } from "@/app/hijack-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HomePage } from "@/pages/home";

const router = createBrowserRouter([{ path: "/", element: <HomePage /> }]);

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
