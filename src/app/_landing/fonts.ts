import { Barlow_Condensed, IBM_Plex_Sans } from "next/font/google";

/** Port and ferry signage: tall, narrow, legible from across a car deck. Used for headlines and numbers. */
export const display = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

/** The face of forms and paperwork. Used for everything you read in a sentence. */
export const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
