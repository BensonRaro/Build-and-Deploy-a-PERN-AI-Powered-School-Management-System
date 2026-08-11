/**
 * Home — Landing page for the Biasly School Management System
 *
 * Composes the full-page sections (Navbar, Hero, Features, Contact, Footer)
 * into a single scrollable landing page experience.
 */

import type { Route } from "./+types/home";
import { Navbar } from "@/components/home/navbar";
import { Hero } from "@/components/home/hero";
import { Features } from "@/components/home/features";
import { Contact } from "@/components/home/contact";
import { Footer } from "@/components/home/footer";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Biasly — AI-Powered School Management System" },
    {
      name: "description",
      content:
        "Biasly brings together AI-driven tools, scheduling, academic tracking, assignments, and fee processing in one elegant platform for modern schools.",
    },
  ];
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
