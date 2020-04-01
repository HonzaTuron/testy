import WebSocket, { Server } from "ws";

const publicWss = new Server({ port: 8081 });
const privateWss = new Server({ port: 8082 });

let publicWs: WebSocket | null = null;
let privateWs: WebSocket | null = null;

privateWss.on("connection", ws => {
  if (!privateWs) privateWs = ws;

  ws.on("message", (_, data) => {
    if (publicWs) publicWs.send(data);
    else ws.send({ connection_status: "INCOMPLETE" });
  });
});

publicWss.on("connection", ws => {
  if (!publicWs) publicWs = ws;

  ws.on("message", (_, data) => {
    if (privateWs) privateWs.send(data);
    else ws.send({ connection_status: "INCOMPLETE" });
  });
});

const exit = () => process.exit(0);
publicWss.on("close", exit);
privateWss.on("close", exit);
