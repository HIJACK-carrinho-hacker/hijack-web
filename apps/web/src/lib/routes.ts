import type { Role } from "@hijack/protocol";

export const homeOf = (role: Role) => (role === "admin" ? "/admin" : role === "hacker" ? "/hacker" : "/pilot");
