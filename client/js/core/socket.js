/*
  SOCKET.JS
  Point de connexion unique vers le serveur.

  Usage :
    import { socket } from "./socket.js";
    socket.emit("player:action", { ... }, (response) => { ... });
*/

export const socket = io();
