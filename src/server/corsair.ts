import { Pool } from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { googledrive } from "@corsair-dev/googledrive";
import { slack } from "@corsair-dev/slack";
import { notion } from "@corsair-dev/notion";
import { todoist } from "@corsair-dev/todoist";
import { zoom } from "@corsair-dev/zoom";
import { hubspot } from "@corsair-dev/hubspot";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nudgehq.tech";

// @ts-ignore
export const corsair = createCorsair({
    multiTenancy: true,
    database: pool,
    kek: process.env.CORSAIR_KEK!,
    connect: {
        redirectUri: `${BASE_URL}/api/connect/callback`,
    },
    plugins: [
        gmail(),
        googlecalendar(),
        googledrive(),
        slack(),
        notion(),
        todoist(),
        zoom(),
        hubspot(),
    ],
});
