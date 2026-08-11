/**
 * AppSidebar — Custom dashboard sidebar for Biasly School Management System
 *
 * Design language ("Aura"):
 * - Frosted glass morphism with backdrop blur
 * - Gradient active state indicators (left border accent, not full background fill)
 * - Animated logo with gradient text
 * - Collapsible groups organized by school management module
 * - User profile card at the bottom with role badge
 * - Theme toggle integrated into the footer
 * - Search/filter input for quick nav access
 * - **Role-aware** — nav items are filtered based on the user's role,
 *   mirroring the backend route permissions (defined in backend/src/routes/)
 *
 * Navigation structure is derived from the Prisma schema entities:
 *   Academic (AcademicYear, Term, Grade, Subject, TimetableSlot)
 *   People   (User, StudentProfile, ParentProfile, StaffProfile)
 *   Attendance, Assessments, Finance, Library, Communication, System
 *
 * Each NavGroup has a `roles` field matching the READ access from backend routes.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  BookOpenIcon,
  GraduationCapIcon,
  CalendarIcon,
  ListChecksIcon,
  BookTextIcon,
  CalendarClockIcon,
  UsersIcon,
  UserCheckIcon,
  UserCogIcon,
  UsersRoundIcon,
  BuildingIcon,
  ClipboardCheckIcon,
  FileSpreadsheetIcon,
  DollarSignIcon,
  PiggyBankIcon,
  FileTextIcon,
  CreditCardIcon,
  BookOpenCheckIcon,
  BookIcon,
  LibraryIcon,
  MegaphoneIcon,
  BellIcon,
  ActivityIcon,
  SparklesIcon,
  SettingsIcon,
  CogIcon,
  ChevronDownIcon,
  SearchIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
  BarChart3Icon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Role } from "@/types";
import { authClient } from "@/lib/auth-client";

// ─── Role Type ──────────────────────────────────────────────────────────────

// Human-readable label for each role
const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  TEACHER: "Teacher",
  LIBRARIAN: "Librarian",
  ACCOUNTANT: "Accountant",
  COUNSELOR: "Counselor",
  STAFF: "Staff",
  STUDENT: "Student",
  PARENT: "Parent",
};

// ─── Navigation Data Structure ───────────────────────────────────────────────
// Roles define who can SEE the item in the sidebar, based on backend route READ access.
// See backend/src/routes/ for the full permission matrix.

type NavSubItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: Role[]; // which roles can read this resource
};

type NavGroup = {
  title: string;
  icon: LucideIcon;
  url?: string; // direct link (no children)
  roles: Role[]; // which roles can read this resource (applies to group + all children)
  children?: NavSubItem[]; // collapsible group
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    icon: LayoutDashboardIcon,
    url: "/dashboard",
    // All authenticated users can see the dashboard overview
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "STAFF",
      "LIBRARIAN",
      "ACCOUNTANT",
      "COUNSELOR",
      "STUDENT",
      "PARENT",
    ],
  },
  {
    title: "Academic",
    icon: BookOpenIcon,
    // READ access per backend: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, STAFF, STUDENT, PARENT
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "STAFF",
      "STUDENT",
      "PARENT",
    ],
    children: [
      {
        title: "Academic Years",
        url: "/dashboard/academic-years",
        icon: CalendarIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "STUDENT",
          "PARENT",
        ],
      },
      // {
      //   title: "Terms",
      //   url: "/dashboard/terms",
      //   icon: ListChecksIcon,
      //   roles: [
      //     "SUPER_ADMIN",
      //     "PRINCIPAL",
      //     "VICE_PRINCIPAL",
      //     "TEACHER",
      //     "STAFF",
      //     "STUDENT",
      //     "PARENT",
      //   ],
      // },
      {
        title: "Grades",
        url: "/dashboard/grades",
        icon: GraduationCapIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "STUDENT",
          "PARENT",
        ],
      },
      {
        title: "Subjects",
        url: "/dashboard/subjects",
        icon: BookTextIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "STUDENT",
          "PARENT",
        ],
      },
      {
        title: "Timetable",
        url: "/dashboard/timetable",
        icon: CalendarClockIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "STUDENT",
          "PARENT",
        ],
      },
    ],
  },
  {
    title: "People",
    icon: UsersIcon,
    // Users READ per backend: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, STAFF
    roles: ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "STAFF"],
    children: [
      {
        title: "Students",
        url: "/dashboard/students",
        icon: UserCheckIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
        ],
      },
      {
        title: "Teachers",
        url: "/dashboard/teachers",
        icon: UserCogIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
        ],
      },
      {
        title: "Parents",
        url: "/dashboard/parents",
        icon: UsersRoundIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
        ],
      },
      {
        title: "Staff",
        url: "/dashboard/staff",
        icon: BuildingIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
        ],
      },
    ],
  },
  {
    title: "Attendance",
    icon: ClipboardCheckIcon,
    url: "/dashboard/attendance",
    // Attendance is viewable by most: admins record it, students/parents view it
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "STAFF",
      "COUNSELOR",
      "STUDENT",
      "PARENT",
    ],
  },
  {
    title: "Assignments",
    icon: SparklesIcon,
    url: "/dashboard/assignments",
    // Teachers create AI assignments, students take them, parents view results
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "COUNSELOR",
      "STUDENT",
      "PARENT",
    ],
  },
  {
    title: "Finance",
    icon: DollarSignIcon,
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "ACCOUNTANT",
      "PARENT",
      "STUDENT",
    ],
    children: [
      {
        title: "Finance Analytics",
        url: "/dashboard/finance-analytics",
        icon: BarChart3Icon,
        roles: ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"],
      },
      {
        title: "Fee Structure",
        url: "/dashboard/fee-structure",
        icon: PiggyBankIcon,
        roles: ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "ACCOUNTANT"],
      },
      {
        title: "Invoices",
        url: "/dashboard/invoices",
        icon: FileTextIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "ACCOUNTANT",
          "PARENT",
        ],
      },
      {
        title: "Payments",
        url: "/dashboard/payments",
        icon: CreditCardIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "ACCOUNTANT",
          "PARENT",
          "STUDENT",
        ],
      },
    ],
  },
  {
    title: "Library",
    icon: BookOpenCheckIcon,
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "STAFF",
      "LIBRARIAN",
      "ACCOUNTANT",
      "COUNSELOR",
      "STUDENT",
      "PARENT",
    ],
    children: [
      {
        // Library-wide analytics — catalog health, circulation, overdue &
        // fines. Mirrors the backend /api/library-analytics roles.
        title: "Library Analytics",
        url: "/dashboard/library-analytics",
        icon: BarChart3Icon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "LIBRARIAN",
          "ACCOUNTANT",
        ],
      },
      {
        title: "Books",
        url: "/dashboard/books",
        icon: BookIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "LIBRARIAN",
          "STUDENT",
          "PARENT",
        ],
      },
      {
        title: "Book Issues",
        url: "/dashboard/book-issues",
        icon: LibraryIcon,
        // Every role sees their OWN borrow history here; staff additionally get
        // the full desk view (Issue/Return) on the page itself.
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "STAFF",
          "LIBRARIAN",
          "ACCOUNTANT",
          "COUNSELOR",
          "STUDENT",
          "PARENT",
        ],
      },
    ],
  },
  {
    title: "Communication",
    icon: MegaphoneIcon,
    // Announcements are readable by EVERYONE per backend
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "LIBRARIAN",
      "ACCOUNTANT",
      "COUNSELOR",
      "STAFF",
      "STUDENT",
      "PARENT",
    ],
    children: [
      {
        title: "Announcements",
        url: "/dashboard/announcements",
        icon: BellIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "LIBRARIAN",
          "ACCOUNTANT",
          "COUNSELOR",
          "STAFF",
          "STUDENT",
          "PARENT",
        ],
      },
    ],
  },
  {
    title: "System",
    icon: SettingsIcon,
    // Mix of admin-only tools
    roles: [
      "SUPER_ADMIN",
      "PRINCIPAL",
      "VICE_PRINCIPAL",
      "TEACHER",
      "COUNSELOR",
    ],
    children: [
      {
        title: "Activity Log",
        url: "/dashboard/activity-log",
        icon: ActivityIcon,
        // Backend: SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL only
        roles: ["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"],
      },
      {
        title: "AI Insights",
        url: "/dashboard/ai-insights",
        icon: SparklesIcon,
        roles: [
          "SUPER_ADMIN",
          "PRINCIPAL",
          "VICE_PRINCIPAL",
          "TEACHER",
          "COUNSELOR",
        ],
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: CogIcon,
        roles: ["SUPER_ADMIN", "PRINCIPAL"],
      },
    ],
  },
];

// ─── Theme Toggle ────────────────────────────────────────────────────────────

const STORAGE_KEY = "biasly-theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

function SidebarThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <SunIcon
        className={cn(
          "size-4 absolute transform-gpu transition-all duration-300",
          dark
            ? "scale-100 opacity-100 rotate-0"
            : "scale-0 opacity-90 rotate-90",
        )}
      />
      <MoonIcon
        className={cn(
          "size-4 absolute transform-gpu transition-all duration-300",
          dark
            ? "scale-0 opacity-0 -rotate-90"
            : "scale-100 opacity-100 rotate-0",
        )}
      />
    </button>
  );
}

// ─── Nav Group Item ──────────────────────────────────────────────────────────

function NavGroupItem({
  group,
  isCollapsed,
  isActiveGroup,
  openGroups,
  toggleGroup,
}: {
  group: NavGroup;
  isCollapsed: boolean;
  isActiveGroup: boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (title: string) => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOpen = openGroups[group.title] ?? true;

  // Direct link item (no children)
  if (!group.children) {
    const isActive = pathname === group.url;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={isCollapsed ? group.title : undefined}
          onClick={() => group.url && navigate(group.url)}
          className={cn(
            "group/menu-button relative transition-all duration-200",
            // Glass active state: gradient left border accent
            isActive &&
              "before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-[2.5px] before:rounded-full before:bg-gradient-to-b before:from-primary before:to-primary/50 before:shadow-sm before:shadow-primary/30",
          )}
        >
          <group.icon className="size-4 shrink-0" />
          <span>{group.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Collapsible group with children
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActiveGroup}
        tooltip={isCollapsed ? group.title : undefined}
        onClick={() => toggleGroup(group.title)}
        className={cn(
          "group/menu-button transition-all duration-200",
          isActiveGroup &&
            "before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-[2.5px] before:rounded-full before:bg-gradient-to-b before:from-primary before:to-primary/50 before:shadow-sm before:shadow-primary/30",
        )}
      >
        <group.icon className="size-4 shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1">{group.title}</span>
            <ChevronDownIcon
              className={cn(
                "size-3.5 text-sidebar-foreground/40 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </>
        )}
      </SidebarMenuButton>

      {/* Collapsible children */}
      {!isCollapsed && isOpen && (
        <SidebarMenuSub>
          {group.children.map((child) => {
            const isChildActive = pathname === child.url;
            return (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton
                  isActive={isChildActive}
                  render={<Link to={child.url} />}
                  className={cn(
                    "transition-all duration-200",
                    isChildActive && "font-medium text-primary",
                  )}
                >
                  <child.icon className="size-3.5" />
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

// ─── Role Filter Helper ──────────────────────────────────────────────────────

/**
 * Returns true if the given role has access to at least one item in the nav group
 * (either the group itself or any of its children).
 */
function hasRoleAccess(group: NavGroup, role: Role): boolean {
  // If group has its own URL, check group-level roles
  if (group.url) {
    return group.roles.includes(role);
  }
  // Otherwise, check if any child matches
  return group.children?.some((child) => child.roles.includes(role)) ?? false;
}

/**
 * Filters the nav groups to only show items the given role can access.
 * If a group has children, individual children are filtered too.
 */
function filterNavByRole(nav: NavGroup[], role: Role): NavGroup[] {
  return nav
    .map((group) => {
      // Skip entire group if role has no access
      if (!hasRoleAccess(group, role)) return null;

      // For groups with children, filter individual children by role
      if (group.children) {
        const filteredChildren = group.children.filter((child) =>
          child.roles.includes(role),
        );
        if (filteredChildren.length === 0 && !group.url) return null;
        return { ...group, children: filteredChildren };
      }

      return group;
    })
    .filter(Boolean) as NavGroup[];
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * AppSidebar — The primary sidebar for the dashboard area.
 *
 * Accepts a `userRole` prop to show only nav items the user has access to,
 * mirroring the backend route permissions.
 *
 * Wrap this inside a `<SidebarProvider>` in the layout.
 */
export function AppSidebar({
  userRole = "STUDENT", // default to STUDENT if not provided
}: {
  userRole?: Role;
}) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate()

  // ── Role-filtered navigation ────────────────────────────────────────
  const roleFilteredNav = useMemo(
    () => filterNavByRole(NAV_GROUPS, userRole),
    [userRole],
  );

  // ── Search / filter state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(false)

  // ── Collapsible group open state ────────────────────────────────────
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(roleFilteredNav.map((g) => [g.title, true])),
  );

  const toggleGroup = useCallback((title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  // ── Filtered navigation based on search ─────────────────────────────
  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return roleFilteredNav;

    const q = searchQuery.toLowerCase();
    return roleFilteredNav
      .map((group) => {
        if (group.title.toLowerCase().includes(q)) return group;
        if (group.children?.some((c) => c.title.toLowerCase().includes(q))) {
          return {
            ...group,
            children: group.children.filter((c) =>
              c.title.toLowerCase().includes(q),
            ),
          };
        }
        return null;
      })
      .filter(Boolean) as NavGroup[];
  }, [searchQuery, roleFilteredNav]);

  // ── Memoize active group check ──────────────────────────────────────
  const { pathname } = useLocation();
  const activeGroupTitles = useMemo(() => {
    const active: string[] = [];
    for (const group of roleFilteredNav) {
      if (group.url === pathname) {
        active.push(group.title);
      } else if (group.children?.some((c) => c.url === pathname)) {
        active.push(group.title);
      }
    }
    return active;
  }, [pathname, roleFilteredNav]);

  // ── User initials for avatar fallback ───────────────────────────────
  const userInitials = userRole
    .split("_")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

    const logout = async () => {
      setLoading(true)
  await authClient.signOut({
  fetchOptions: {
      onSuccess: () => {
          toast.success("Logged out successfully", {
            description: "You have logged outsuccessfully",
          });
          navigate("/")
      setLoading(false)
    },
      onError: () => {
      toast.error("Something went wrong")
      setLoading(false)
    },
  },
});
    }

  return (
    <Sidebar collapsible="icon">
      {/* ── Mobile overlay header ────────────────────────────────────── */}
      {isMobile && (
        <div className="flex items-center gap-2 border-b border-sidebar-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <GraduationCapIcon className="size-3.5" />
            </span>
            <span className="bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/60 bg-clip-text text-sm font-semibold text-transparent">
              Biasly
            </span>
          </div>
        </div>
      )}

      {/* ── Sidebar Header (Logo Area) ───────────────────────────────── */}
      <SidebarHeader className="relative overflow-hidden border-b border-sidebar-border/40 px-3 py-3">
        {/* Subtle gradient glow in the header background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-20 -top-20 h-40 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent blur-3xl"
        />

        {isCollapsed ? (
          // Collapsed: just the icon
          <div className="flex items-center justify-center">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 group-hover/sidebar-wrapper:shadow-primary/30">
              <GraduationCapIcon className="size-4" />
            </span>
          </div>
        ) : (
          // Expanded: brand with gradient text
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-300 group-hover/sidebar-wrapper:shadow-primary/30">
              <GraduationCapIcon className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <span className="bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-base font-bold leading-tight tracking-tight text-transparent">
                Biasly
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40">
                School Management
              </span>
            </div>
          </div>
        )}
      </SidebarHeader>

      {/* ── Sidebar Content ──────────────────────────────────────────── */}
      <SidebarContent className="[&_[data-slot=sidebar-content]]:gap-0">
        {/* Search Input (only when expanded) */}
        {!isCollapsed && (
          <div className="relative mx-3 mb-1 mt-2">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
            <Input
              placeholder="Search navigation…"
              aria-label="Search navigation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg border-sidebar-border/50 bg-sidebar-accent/30 pl-8 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/10"
            />
          </div>
        )}

        {/* Navigation Groups — filtered by role */}
        {filteredNav.map((group) => {
          const isActiveGroup = activeGroupTitles.includes(group.title);

          return (
            <SidebarGroup key={group.title} className="px-2 py-0.5">
              {/* Section label (only visible when expanded) */}
              {!isCollapsed && (
                <SidebarGroupLabel
                  className={cn(
                    "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/35",
                    isActiveGroup && "text-sidebar-foreground/60",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block size-1 rounded-full transition-all duration-300",
                        isActiveGroup
                          ? "bg-primary shadow-sm shadow-primary/40"
                          : "bg-sidebar-foreground/20",
                      )}
                    />
                    {group.title}
                  </span>
                </SidebarGroupLabel>
              )}

              <SidebarGroupContent>
                <SidebarMenu>
                  <NavGroupItem
                    group={group}
                    isCollapsed={isCollapsed}
                    isActiveGroup={isActiveGroup}
                    openGroups={openGroups}
                    toggleGroup={toggleGroup}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Empty state when no nav items match */}
        {filteredNav.length === 0 && !isCollapsed && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <SearchIcon className="mb-2 size-8 text-sidebar-foreground/20" />
            <p className="text-sm text-sidebar-foreground/40">
              No navigation items found.
            </p>
          </div>
        )}
      </SidebarContent>

      {/* ── Sidebar Footer (User Profile + Controls) ─────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border/40 p-3">
        {isCollapsed ? (
          // Collapsed: minimal avatar + controls row
          <div className="flex flex-col items-center gap-2">
            <Avatar size="sm" className="ring-1 ring-sidebar-border/50">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-sidebar-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <SidebarThemeToggle />
          </div>
        ) : (
          // Expanded: full user profile card with dynamic role
          <div className="space-y-2">
            <div className="group relative overflow-hidden rounded-xl border border-sidebar-border/40 bg-sidebar-accent/30 p-3 transition-all duration-200 hover:border-sidebar-border/60 hover:bg-sidebar-accent/50">
              {/* Subtle glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 size-20 rounded-full bg-primary/5 blur-2xl"
              />

              <div className="relative flex items-center gap-3">
                <Avatar size="sm" className="ring-1 ring-sidebar-border/50">
                  <AvatarImage src="" alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-xs font-semibold text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-sidebar-foreground">
                    {ROLE_LABELS[userRole]}
                  </span>
                  <span className="truncate text-[11px] text-sidebar-foreground/50">
                    {userRole.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-primary"
                >
                  {userRole === "SUPER_ADMIN"
                    ? "Admin"
                    : userRole === "PRINCIPAL" || userRole === "VICE_PRINCIPAL"
                      ? "Admin"
                      : userRole === "STUDENT"
                        ? "Student"
                        : userRole === "PARENT"
                          ? "Parent"
                          : ROLE_LABELS[userRole].split(" ")[0]}
                </Badge>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-1">
              <SidebarThemeToggle />
              <button
                type="button"
                aria-label="Sign out"
                className="inline-flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/40 transition-all duration-200 hover:bg-sidebar-accent hover:text-destructive"
                disabled={loading}
                onClick={logout}
              >
                <LogOutIcon className="size-4" />
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
