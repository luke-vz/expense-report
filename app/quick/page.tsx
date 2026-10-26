// app/quick/page.tsx
import { redirect } from "next/navigation";

// Quick entry lived here briefly (PR #27) and apps installed then open on /quick: send them to "/"
export default function QuickRedirect() {
  redirect("/");
}
