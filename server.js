const express = require("express");
const app = express();
const http = require("http").createServer(app);

app.use(express.static("public"));

http.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
