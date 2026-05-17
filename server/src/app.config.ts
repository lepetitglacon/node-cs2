import {
    Server,
    defineServer,
    defineRoom,
    monitor,
    playground,
    createRouter,
    createEndpoint
} from "colyseus";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom.js";
import {LobbyRoom} from "./rooms/LobbyRoom.js";

const server = defineServer({
    /**
     * Define your room handlers:
     */
    rooms: {
        lobby: defineRoom(LobbyRoom),
        my_room: defineRoom(MyRoom).enableRealtimeListing()
    },

    /**
     * Experimental: Define API routes. Built-in integration with the "playground" and SDK.
     * 
     * Usage from SDK: 
     *   client.http.get("/api/hello").then((response) => {})
     * 
     */
    routes: createRouter({
        api_hello: createEndpoint("/api/hello", { method: "GET", }, async (ctx) => {
            return { message: "Hello World" }
        })
    }),


    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    express: (app) => {
        app.use("/assets", express.static(path.join(__dirname, "../public/assets")));
        console.log(`serving statics ${path.join(__dirname, "../public/assets")}`)

        // Serve client's dist folder in production
        const clientDist = path.join(__dirname, "../../client/dist");
        if (process.env.NODE_ENV === "production") {
            app.use(express.static(clientDist));
            app.get("*", (req, res, next) => {
                // Do not intercept Colyseus or API routes
                if (req.path.startsWith("/api") || req.path.startsWith("/matchmake")) {
                    return next();
                }
                res.sendFile(path.join(clientDist, "index.html"));
            });
        }

        app.get("/hi", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    }

});

export default server;