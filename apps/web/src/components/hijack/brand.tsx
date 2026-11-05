import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return <span className={cn("font-mono text-3xl font-bold tracking-[0.2em] text-primary-strong", className)}>HIJACK</span>;
}
