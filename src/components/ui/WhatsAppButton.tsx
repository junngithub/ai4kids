import { FaWhatsapp } from "react-icons/fa";

/**
 * Floating click-to-chat WhatsApp button (like lyza.com.sg) — opens a chat to
 * the academy's number. `number` is digits-only with country code (e.g. 6588…).
 */
export function WhatsAppButton({ number }: { number: string }) {
  const clean = number.replace(/[^0-9]/g, "");
  const msg = encodeURIComponent(
    "Hi! I'd like to know more about AI Kids Academy classes for my child.",
  );
  return (
    <a
      href={`https://wa.me/${clean}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white font-fun font-semibold shadow-lg shadow-green-500/30 transition hover:scale-105 hover:bg-[#1ebe57]"
    >
      <FaWhatsapp className="text-2xl" />
      <span className="hidden sm:inline">Chat with us</span>
    </a>
  );
}
