import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Contact Us</h1>
      <p className="mt-2 text-neutral-600">We reply within 2 business days.</p>
      <ContactForm />
    </div>
  );
}
