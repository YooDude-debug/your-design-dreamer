import { createHash } from "node:crypto";
import { RESPONSE_SCHEMA, SYSTEM_PROMPT } from "@/orb-core/analysis/analyze.server";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
console.log(sha(JSON.stringify(RESPONSE_SCHEMA)), sha(SYSTEM_PROMPT));
