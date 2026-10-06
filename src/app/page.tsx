import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";

export default async function Home() {
  redirect((await getAuth()) ? "/app" : "/login");
}
